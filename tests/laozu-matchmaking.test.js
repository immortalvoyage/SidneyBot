import test from "node:test";
import assert from "node:assert/strict";
import {
  findMatchProfiles,
  publishMatchProfile,
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

const members = [
  { userId: "1", displayName: "小月", active: true },
  { userId: "2", displayName: "丹青", active: true },
  { userId: "3", displayName: "長風", active: true }
];

test("沒有明確同意時拒絕刊登媒合資料", async () => {
  await assert.rejects(
    publishMatchProfile(env(), {
      guildId: "guild",
      member: members[1],
      skills: "副本教學",
      availability: "晚上",
      consent: ""
    }),
    /明確選擇同意公開媒合/
  );
});

test("只媒合已同意公開且符合需求的其他成員", async () => {
  const storage = env();
  await publishMatchProfile(storage, {
    guildId: "guild", member: members[1], skills: "副本教學、裝備搭配",
    availability: "平日晚上", note: "新手也可以", consent: "AGREE"
  });
  await publishMatchProfile(storage, {
    guildId: "guild", member: members[2], skills: "拍照、外觀搭配",
    availability: "週末", consent: "AGREE"
  });
  const matches = await findMatchProfiles(storage, {
    guildId: "guild", requesterId: "1", need: "需要副本教學", members
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].userId, "2");
  assert.equal(matches[0].consent, true);
});

test("撤回後立即不再出現在媒合結果", async () => {
  const storage = env();
  await publishMatchProfile(storage, {
    guildId: "guild", member: members[1], skills: "副本教學",
    availability: "晚上", consent: "AGREE"
  });
  await withdrawMatchProfile(storage, "guild", "2");
  const matches = await findMatchProfiles(storage, {
    guildId: "guild", requesterId: "1", need: "副本教學", members
  });
  assert.deepEqual(matches, []);
});
