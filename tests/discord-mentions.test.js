import test from "node:test";
import assert from "node:assert/strict";
import {
  directRosterReply,
  extractMentionQuestion,
  formatMentionedMemberContext,
  formatSectRosterContext,
  handleDiscordMentionEvent,
  needsSectRosterContext,
  processMatchListingChat
} from "../src/integrations/discord-mentions.js";
import { parseMatchProfileDraft } from "../src/platform/laozu-matchmaking.js";

test("extracts normal and nickname Discord mentions", () => {
  assert.equal(extractMentionQuestion("<@123456789> 妳在嗎？", "123456789"), "妳在嗎？");
  assert.equal(extractMentionQuestion("請問 <@!123456789> 今天心情如何", "123456789"), "請問 今天心情如何");
  assert.equal(extractMentionQuestion("沒有提及", "bad"), "");
});

test("涉及玩家 mention 或名冊問題時載入正式名冊", () => {
  assert.equal(needsSectRosterContext("仙遊者中有這個人嗎？", ["222"]), true);
  assert.equal(needsSectRosterContext("仙遊者中有哪些玩家？"), true);
  assert.equal(needsSectRosterContext("今天天氣如何？"), false);
  const context = formatSectRosterContext([
    { userId: "111", displayName: "凜冬皓月", rank: "master", active: true },
    { userId: "222", displayName: "沈慕白", rank: "disciple", active: true }
  ]);
  assert.match(context, /Discord ID 111｜名稱 凜冬皓月｜身分 宗主/);
  assert.match(context, /Discord ID 222｜名稱 沈慕白｜身分 門徒/);
  assert.match(context, /不得把目前說話者的 ID 套到其他 mention/);
});

test("名冊問題直接輸出分組名稱且不暴露 Discord ID", () => {
  const reply = directRosterReply("仙遊者目前有哪些玩家？", [
    { userId: "111", displayName: "凜冬皓月", rank: "master", active: true },
    { userId: "222", displayName: "沈慕白", rank: "disciple", active: true },
    { userId: "333", displayName: "已離開", rank: "resident", active: false }
  ]);
  assert.match(reply, /共有 \*\*2 位\*\*/);
  assert.match(reply, /\*\*宗主（1）\*\*/);
  assert.match(reply, /\*\*門徒（1）\*\*/);
  assert.match(reply, /凜冬皓月/);
  assert.match(reply, /沈慕白/);
  assert.doesNotMatch(reply, /111|222|333|已離開|<@/);
});

test("指定玩家介紹不再被固定名稱身分模板攔截", () => {
  const members = [{ userId: "222", displayName: "沈慕白", rank: "disciple", active: true }];
  assert.equal(directRosterReply("<@222> 是誰？", members, ["222"]), null);
  assert.equal(directRosterReply("<@999> 是誰？", members, ["999"]), null);
});

test("人物介紹上下文只提供正式名冊與本人同意公開資料", async () => {
  const values = new Map([
    ["laozu:match:v1:guild:222", JSON.stringify({
      userId: "222", consent: true, skills: "副本帶隊、裝備搭配", availability: "平日晚間", note: "可協助新人"
    })]
  ]);
  const context = await formatMentionedMemberContext({
    BOT_MEMORY: { async get(key, options) {
      const value = values.get(key);
      return options?.type === "json" && value ? JSON.parse(value) : value || null;
    } }
  }, "guild", [
    { userId: "222", displayName: "沈慕白", rank: "elder", active: true }
  ], ["222", "999"]);
  assert.match(context, /名稱 沈慕白｜身分 長老/);
  assert.match(context, /本人同意公開的專長 副本帶隊、裝備搭配/);
  assert.match(context, /正式名冊查無此人/);
  assert.match(context, /不要只把名稱與身分重念一遍/);
  assert.match(context, /不得編故事/);
});

test("mention endpoint rejects unsigned events", async () => {
  const request = new Request("https://sidney.test/integrations/discord-mentions", { method: "POST", body: "{}" });
  const response = await handleDiscordMentionEvent(request, { DISCORD_GATEWAY_SECRET: "x".repeat(32) });
  assert.equal(response.status, 401);
});

test("沒有真實草稿時確認更新不得交給 AI 假稱完成", async () => {
  const reply = await processMatchListingChat({ BOT_MEMORY: { async get() { return null; } } }, {
    guildId: "guild",
    member: { userId: "111", active: true },
    question: "確認更新"
  });
  assert.match(reply, /沒有等待確認/);
  assert.match(reply, /沒有更新任何資料/);
});

test("沒有刊登草稿時一般 OK 不得誤入專長確認流程", async () => {
  const reply = await processMatchListingChat({ BOT_MEMORY: { async get() { return null; } } }, {
    guildId: "guild",
    member: { userId: "111", active: true },
    question: "OK"
  });
  assert.equal(reply, null);
});

test("詢問老祖的學習能力不會建立專長草稿", () => {
  assert.equal(parseMatchProfileDraft("請問一下你目前還有學習的能力嗎？"), null);
  assert.equal(parseMatchProfileDraft("我的能力是程式設計")?.skills, "程式設計");
});

test("討論專長更新 BUG 不會建立專長草稿", () => {
  for (const text of [
    "專長更新",
    "你怎麼又繞進專長更新了？",
    "剛才那句話被你塞進專長更新",
    "請修正專長更新的 BUG"
  ]) assert.equal(parseMatchProfileDraft(text), null, text);
});
