import test from "node:test";
import assert from "node:assert/strict";
import { processMatchListingChat } from "../src/integrations/discord-mentions.js";
import { getMatchProfile } from "../src/platform/laozu-matchmaking.js";

function createEnv() {
  const values = new Map();
  return {
    BOT_MEMORY: {
      async get(key, options) {
        const value = values.get(key);
        if (value === undefined) return null;
        return options?.type === "json" ? JSON.parse(value) : value;
      },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    }
  };
}

const member = {
  userId: "200",
  username: "member",
  displayName: "一般成員",
  active: true
};

test("已有刊登時重新提供資料會先比較並等待確認更新", async () => {
  const env = createEnv();

  const firstDraft = await processMatchListingChat(env, {
    guildId: "guild",
    member,
    question: "我擅長程式設計、影片剪輯，方便時間：晚上"
  });
  assert.match(firstDraft, /尚未公開/);

  await processMatchListingChat(env, {
    guildId: "guild",
    member,
    question: "確認"
  });

  const original = await getMatchProfile(env, "guild", member.userId);
  assert.equal(original.skills, "程式設計、影片剪輯");
  assert.equal(original.availability, "晚上");

  const replacementDraft = await processMatchListingChat(env, {
    guildId: "guild",
    member,
    question: "我擅長Discord Bot、自動化，方便時間：週末"
  });

  assert.match(replacementDraft, /取代現有刊登/);
  assert.match(replacementDraft, /目前公開內容/);
  assert.match(replacementDraft, /程式設計、影片剪輯/);
  assert.match(replacementDraft, /準備更新為/);
  assert.match(replacementDraft, /Discord Bot、自動化/);

  const beforeConfirm = await getMatchProfile(env, "guild", member.userId);
  assert.equal(beforeConfirm.skills, "程式設計、影片剪輯");

  const confirmed = await processMatchListingChat(env, {
    guildId: "guild",
    member,
    question: "確認更新"
  });
  assert.match(confirmed, /舊刊登已由這筆新資料取代/);

  const updated = await getMatchProfile(env, "guild", member.userId);
  assert.equal(updated.skills, "Discord Bot、自動化");
  assert.equal(updated.availability, "週末");
});

test("重複提供完全相同資料不建立多餘更新", async () => {
  const env = createEnv();
  await processMatchListingChat(env, {
    guildId: "guild",
    member,
    question: "我擅長程式設計，方便時間：隨時"
  });
  await processMatchListingChat(env, { guildId: "guild", member, question: "確認" });

  const reply = await processMatchListingChat(env, {
    guildId: "guild",
    member,
    question: "我擅長程式設計，方便時間：隨時"
  });
  assert.match(reply, /內容與這次提供的資料相同/);
}
