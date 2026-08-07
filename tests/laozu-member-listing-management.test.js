import test from "node:test";
import assert from "node:assert/strict";
import {
  getMatchProfile,
  parseMatchProfilePatch,
  publishMatchProfile,
  updateMatchProfile,
  withdrawMatchProfile
} from "../src/platform/laozu-matchmaking.js";

function env() {
  const values = new Map();
  return {
    BOT_MEMORY: {
      async get(key, options) {
        const value = values.get(key);
        return options?.type === "json" && value ? JSON.parse(value) : value ?? null;
      },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    }
  };
}

const member = { userId: "200", username: "member", displayName: "一般成員", active: true };

test("一般成員可查看自己實際已刊登的資料", async () => {
  const storage = env();
  await publishMatchProfile(storage, {
    guildId: "guild",
    member,
    skills: "程式設計、影片剪輯",
    availability: "晚上",
    note: "請先私訊",
    consent: "AGREE"
  });
  const profile = await getMatchProfile(storage, "guild", member.userId);
  assert.equal(profile.userId, member.userId);
  assert.equal(profile.skills, "程式設計、影片剪輯");
  assert.equal(profile.availability, "晚上");
});

test("一般成員可只修改自己指定的刊登欄位", async () => {
  const storage = env();
  await publishMatchProfile(storage, {
    guildId: "guild",
    member,
    skills: "程式設計、影片剪輯",
    availability: "晚上",
    note: "請先私訊",
    consent: "AGREE"
  });
  const patch = parseMatchProfilePatch("修改我的刊登 專長：程式設計、Discord Bot，方便時間：週末");
  const updated = await updateMatchProfile(storage, {
    guildId: "guild",
    member,
    skillList: patch.skillList,
    availability: patch.availability,
    note: patch.note
  });
  assert.equal(updated.skills, "程式設計、Discord Bot");
  assert.equal(updated.availability, "週末");
  assert.equal(updated.note, "請先私訊");
});

test("詢問老祖是否還有學習能力不會被解析成專長", () => {
  assert.equal(parseMatchProfilePatch("請問一下你目前還有學習的能力嗎？").skillList, null);
});

test("一般成員可刪除自己的刊登", async () => {
  const storage = env();
  await publishMatchProfile(storage, {
    guildId: "guild",
    member,
    skills: "程式設計",
    availability: "隨時",
    consent: "AGREE"
  });
  await withdrawMatchProfile(storage, "guild", member.userId);
  assert.equal(await getMatchProfile(storage, "guild", member.userId), null);
});
