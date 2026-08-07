import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmMatchProfileDraft,
  getMatchProfile,
  parseMatchProfileDraft,
  publishMatchProfile,
  saveMatchProfileDraft
} from "../src/platform/laozu-matchmaking.js";

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

test("已有刊登時新草稿在確認前不覆蓋舊資料，確認後取代同一筆刊登", async () => {
  const env = createEnv();

  await publishMatchProfile(env, {
    guildId: "guild",
    member,
    skills: "程式設計、影片剪輯",
    availability: "晚上",
    consent: "AGREE"
  });

  const replacement = parseMatchProfileDraft(
    "我擅長Discord Bot、自動化，方便時間：週末"
  );
  assert.deepEqual(replacement.skillList, ["Discord Bot", "自動化"]);

  await saveMatchProfileDraft(env, {
    guildId: "guild",
    member,
    draft: replacement
  });

  const beforeConfirm = await getMatchProfile(env, "guild", member.userId);
  assert.equal(beforeConfirm.skills, "程式設計、影片剪輯");
  assert.equal(beforeConfirm.availability, "晚上");

  const updated = await confirmMatchProfileDraft(env, {
    guildId: "guild",
    member
  });

  assert.equal(updated.userId, member.userId);
  assert.equal(updated.skills, "Discord Bot、自動化");
  assert.equal(updated.availability, "週末");

  const stored = await getMatchProfile(env, "guild", member.userId);
  assert.equal(stored.skills, "Discord Bot、自動化");
  assert.equal(stored.availability, "週末");
});

test("同一玩家重複刊登仍只覆蓋固定的單一 profile key", async () => {
  const env = createEnv();

  await publishMatchProfile(env, {
    guildId: "guild",
    member,
    skills: "程式設計",
    availability: "隨時",
    consent: "AGREE"
  });

  await publishMatchProfile(env, {
    guildId: "guild",
    member,
    skills: "Discord Bot、自動化",
    availability: "週末",
    consent: "AGREE"
  });

  const stored = await getMatchProfile(env, "guild", member.userId);
  assert.equal(stored.skills, "Discord Bot、自動化");
  assert.equal(stored.availability, "週末");
});

test("想找特定領域兼職可建立真實更新草稿", () => {
  const draft = parseMatchProfileDraft("我最近想找程式設計相關的兼職，可以幫我留意嗎？");
  assert.deepEqual(draft.skillList, ["程式設計"]);
});
