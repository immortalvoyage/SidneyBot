import assert from "node:assert/strict";
import test from "node:test";

import { RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";
import { getPlayerState } from "../src/platform/player-state-storage.js";
import {
  previousDate,
  recordDailyGreeting,
  taipeiDate
} from "../src/platform/daily-greeting.js";

function createEnv() {
  const values = new Map();
  return {
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

async function addMember(env, userId = "member-1") {
  await upsertMember(env, {
    userId,
    username: userId,
    displayName: "月兔",
    rank: RANK.DISCIPLE
  });
}

test("請安日期依 Asia/Taipei 跨日", () => {
  assert.equal(taipeiDate(new Date("2026-08-04T15:59:59Z")), "2026-08-04");
  assert.equal(taipeiDate(new Date("2026-08-04T16:00:00Z")), "2026-08-05");
  assert.equal(previousDate("2026-03-01"), "2026-02-28");
});

test("每日首次請安增加好感、連續天數及累計天數", async () => {
  const env = createEnv();
  await addMember(env);

  const first = await recordDailyGreeting(env, "member-1", new Date("2026-08-04T02:00:00Z"));
  const second = await recordDailyGreeting(env, "member-1", new Date("2026-08-05T02:00:00Z"));

  assert.equal(first.created, true);
  assert.equal(second.created, true);
  assert.equal(second.state.greeting.currentStreak, 2);
  assert.equal(second.state.greeting.longestStreak, 2);
  assert.equal(second.state.greeting.totalDays, 2);
  assert.equal(second.state.relationship.favor, 52);
});

test("同一台灣日期重複請安不重複加分", async () => {
  const env = createEnv();
  await addMember(env);

  await recordDailyGreeting(env, "member-1", new Date("2026-08-04T01:00:00Z"));
  const duplicate = await recordDailyGreeting(env, "member-1", new Date("2026-08-04T14:00:00Z"));
  const state = await getPlayerState(env, "member-1");

  assert.equal(duplicate.created, false);
  assert.equal(state.greeting.totalDays, 1);
  assert.equal(state.relationship.favor, 51);
});

test("中斷一天後連續天數重設，非正式成員不可請安", async () => {
  const env = createEnv();
  await addMember(env);
  await recordDailyGreeting(env, "member-1", new Date("2026-08-01T02:00:00Z"));
  const resumed = await recordDailyGreeting(env, "member-1", new Date("2026-08-03T02:00:00Z"));

  assert.equal(resumed.state.greeting.currentStreak, 1);
  assert.equal(resumed.state.greeting.longestStreak, 1);
  await assert.rejects(recordDailyGreeting(env, "outsider", new Date()), /正式成員/);
});
