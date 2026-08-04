import assert from "node:assert/strict";
import test from "node:test";

import { RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";
import { removeSectMember } from "../src/sect/service.js";
import {
  getPlayerState,
  playerStateKey
} from "../src/platform/player-state-storage.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    BOT_MEMORY: {
      async get(key) {
        const value = values.get(key);
        return value === undefined ? null : JSON.parse(value);
      },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    }
  };
}

const master = {
  userId: "master-1",
  username: "master",
  displayName: "宗主",
  rank: RANK.MASTER
};

test("正式成員建立時自動建立預設萬象錄玩家狀態", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "member-1",
    username: "moon.rabbit",
    displayName: "月兔",
    rank: RANK.DISCIPLE,
    joinedAt: "2026-08-04T00:00:00.000Z"
  });

  const state = await getPlayerState(env, "member-1");
  assert.equal(state.userId, "member-1");
  assert.equal(state.identity.displayName, "月兔");
  assert.equal(state.relationship.favor, 50);
  assert.equal(state.relationship.trust, 50);
  assert.equal(state.relationship.grudge, 0);
  assert.equal(state.createdAt, "2026-08-04T00:00:00.000Z");
});

test("名冊更新只同步名稱並保留既有萬象錄關係資料", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "member-1",
    username: "moon.rabbit",
    displayName: "月兔",
    rank: RANK.DISCIPLE
  });

  const key = playerStateKey("member-1");
  const state = await env.BOT_MEMORY.get(key);
  state.relationship.favor = 88;
  state.greeting.totalDays = 12;
  await env.BOT_MEMORY.put(key, JSON.stringify(state));

  await upsertMember(env, {
    userId: "member-1",
    displayName: "皓月兔",
    rank: RANK.ELDER
  });

  const updated = await getPlayerState(env, "member-1");
  assert.equal(updated.identity.displayName, "皓月兔");
  assert.equal(updated.relationship.favor, 88);
  assert.equal(updated.greeting.totalDays, 12);
  assert.equal(updated.createdAt, state.createdAt);
});

test("成員移除後保留萬象錄歷史資料", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "member-1",
    username: "member",
    displayName: "測試成員",
    rank: RANK.DISCIPLE
  });

  await removeSectMember(env, master, "member-1", "REMOVE");

  const state = await getPlayerState(env, "member-1");
  assert.equal(state.userId, "member-1");
  assert.equal(state.identity.displayName, "測試成員");
});

test("空白 userId 不會讀取或建立萬象錄 Key", async () => {
  const env = createEnv();
  assert.equal(await getPlayerState(env, ""), null);
  assert.throws(() => playerStateKey(""), /userId/);
});
