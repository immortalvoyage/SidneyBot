import assert from "node:assert/strict";
import test from "node:test";

import { GAME_IDS, GAME_KEYS } from "../src/platform/games/constants.js";
import { RANK } from "../src/sect/constants.js";
import { listAudits } from "../src/sect/audit.js";
import { getMember, upsertMember } from "../src/sect/members.js";
import { removeSectMember } from "../src/sect/service.js";

function createEnv(masterId = "master-1") {
  const values = new Map();

  return {
    SECT_MASTER_ID: masterId,
    BOT_MEMORY: {
      async get(key) {
        const value = values.get(key);
        return value === undefined ? null : JSON.parse(value);
      },
      async put(key, value) {
        values.set(key, value);
      },
      async delete(key) {
        values.delete(key);
      }
    }
  };
}

function actor(rank = RANK.MASTER) {
  return {
    userId: "master-1",
    username: "master",
    displayName: "宗主",
    rank
  };
}

async function seedMember(env, overrides = {}) {
  return upsertMember(env, {
    userId: "member-1",
    username: "member",
    displayName: "測試成員",
    rank: RANK.DISCIPLE,
    joinedAt: "2026-01-01T00:00:00.000Z",
    approvedBy: "master-1",
    ...overrides
  });
}

test("宗主確認後可移除弟子並保留遊戲綁定與 Audit", async () => {
  const env = createEnv();
  await seedMember(env);

  const accountKey = GAME_KEYS.ACCOUNT_BY_USER(GAME_IDS.WWM, "member-1");
  const account = { userId: "member-1", uid: "123456789" };
  await env.BOT_MEMORY.put(accountKey, JSON.stringify(account));

  const removed = await removeSectMember(
    env,
    actor(),
    "member-1",
    "REMOVE",
    "長期未參與"
  );

  assert.equal(removed.rank, RANK.DISCIPLE);
  assert.equal(await getMember(env, "member-1"), null);
  assert.deepEqual(await env.BOT_MEMORY.get(accountKey), account);

  const [audit] = await listAudits(env);
  assert.equal(audit.action, "member.removed");
  assert.equal(audit.actorId, "master-1");
  assert.equal(audit.targetId, "member-1");
  assert.deepEqual(audit.details, {
    displayName: "測試成員",
    previousRank: RANK.DISCIPLE,
    gameBindingPreserved: true,
    note: "長期未參與"
  });
});

test("長老不能移除成員", async () => {
  const env = createEnv();
  await seedMember(env);

  await assert.rejects(
    removeSectMember(env, actor(RANK.ELDER), "member-1", "REMOVE"),
    /只有宗主/
  );

  assert.ok(await getMember(env, "member-1"));
});

test("沒有明確確認時不能移除成員", async () => {
  const env = createEnv();
  await seedMember(env);

  await assert.rejects(
    removeSectMember(env, actor(), "member-1", ""),
    /確認移除/
  );

  assert.ok(await getMember(env, "member-1"));
  assert.deepEqual(await listAudits(env), []);
});

test("不能移除設定中的宗主", async () => {
  const env = createEnv();
  await seedMember(env, {
    userId: "master-1",
    displayName: "宗主",
    rank: RANK.MASTER
  });

  await assert.rejects(
    removeSectMember(env, actor(), "master-1", "REMOVE"),
    /宗主身分受到保護/
  );

  assert.ok(await getMember(env, "master-1"));
});

test("不能移除不存在或非正式成員", async () => {
  const env = createEnv();

  await assert.rejects(
    removeSectMember(env, actor(), "missing", "REMOVE"),
    /找不到該仙遊者成員/
  );

  await seedMember(env, { rank: RANK.PENDING });
  await assert.rejects(
    removeSectMember(env, actor(), "member-1", "REMOVE"),
    /只能移除正式弟子或長老/
  );
});
