import assert from "node:assert/strict";
import test from "node:test";

import { RANK } from "../src/sect/constants.js";
import { listAudits } from "../src/sect/audit.js";
import { getMember, upsertMember } from "../src/sect/members.js";
import { setMemberRank } from "../src/sect/service.js";

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

test("宗主可將弟子升為長老並寫入 Audit", async () => {
  const env = createEnv();
  await seedMember(env);

  const updated = await setMemberRank(
    env,
    actor(),
    "member-1",
    RANK.ELDER,
    "協助管理"
  );

  assert.equal(updated.rank, RANK.ELDER);
  assert.equal(updated.joinedAt, "2026-01-01T00:00:00.000Z");
  assert.equal((await getMember(env, "member-1")).rank, RANK.ELDER);

  const [audit] = await listAudits(env);
  assert.equal(audit.action, "member.rank_changed");
  assert.equal(audit.actorId, "master-1");
  assert.equal(audit.targetId, "member-1");
  assert.deepEqual(audit.details, {
    previousRank: RANK.DISCIPLE,
    newRank: RANK.ELDER,
    note: "協助管理",
    discordRoleSync: { status: "not_requested" }
  });
});

test("Discord 身分組同步失敗時不更新 KV 或 Audit", async () => {
  const env = createEnv();
  await seedMember(env);
  await assert.rejects(
    setMemberRank(env, actor(), "member-1", RANK.ELDER, "", async () => {
      throw new Error("Discord HTTP 403");
    }),
    /Discord HTTP 403/
  );
  assert.equal((await getMember(env, "member-1")).rank, RANK.DISCIPLE);
  assert.deepEqual(await listAudits(env), []);
});

test("長老不能調整其他成員身分", async () => {
  const env = createEnv();
  await seedMember(env);

  await assert.rejects(
    setMemberRank(env, actor(RANK.ELDER), "member-1", RANK.ELDER),
    /只有宗主/
  );
});

test("不能透過 set-rank 修改宗主", async () => {
  const env = createEnv();
  await seedMember(env, {
    userId: "master-1",
    displayName: "宗主",
    rank: RANK.MASTER
  });

  await assert.rejects(
    setMemberRank(env, actor(), "master-1", RANK.DISCIPLE),
    /宗主身分受到保護/
  );
});

test("不能指派宗主或調整不存在的成員", async () => {
  const env = createEnv();
  await seedMember(env);

  await assert.rejects(
    setMemberRank(env, actor(), "member-1", RANK.MASTER),
    /只能設定為領民、門徒或長老/
  );

  await assert.rejects(
    setMemberRank(env, actor(), "missing", RANK.ELDER),
    /找不到該仙遊者成員/
  );
});

test("相同身分不重複寫入", async () => {
  const env = createEnv();
  await seedMember(env);

  await assert.rejects(
    setMemberRank(env, actor(), "member-1", RANK.DISCIPLE),
    /目前已是此身分/
  );

  assert.deepEqual(await listAudits(env), []);
});

test("未綁定 UID 的領民不能手動升為門徒或長老", async () => {
  const env = createEnv();
  await seedMember(env, { rank: RANK.RESIDENT });
  await assert.rejects(
    setMemberRank(env, actor(), "member-1", RANK.DISCIPLE),
    /尚未綁定.*UID/
  );
  await assert.rejects(
    setMemberRank(env, actor(), "member-1", RANK.ELDER),
    /尚未綁定.*UID/
  );
});
