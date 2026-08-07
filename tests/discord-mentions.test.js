import test from "node:test";
import assert from "node:assert/strict";
import {
  directRosterReply,
  extractMentionQuestion,
  formatSectRosterContext,
  handleDiscordMentionEvent,
  needsSectRosterContext
} from "../src/integrations/discord-mentions.js";

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

test("指定玩家身分只依正式名冊精確回答", () => {
  const members = [{ userId: "222", displayName: "沈慕白", rank: "disciple", active: true }];
  assert.equal(
    directRosterReply("<@222> 是誰？", members, ["222"]),
    "這位是 **沈慕白**，目前身分為 **門徒**。"
  );
  assert.match(directRosterReply("<@999> 是誰？", members, ["999"]), /查無這位玩家/);
});

test("mention endpoint rejects unsigned events", async () => {
  const request = new Request("https://sidney.test/integrations/discord-mentions", { method: "POST", body: "{}" });
  const response = await handleDiscordMentionEvent(request, { DISCORD_GATEWAY_SECRET: "x".repeat(32) });
  assert.equal(response.status, 401);
});
