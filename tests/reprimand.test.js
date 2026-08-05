import assert from "node:assert/strict";
import test from "node:test";

import { RANK } from "../src/sect/constants.js";
import { listAudits } from "../src/sect/audit.js";
import { upsertMember } from "../src/sect/members.js";
import { getPlayerState } from "../src/platform/player-state-storage.js";
import { reprimandPlayer } from "../src/platform/reprimand.js";

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
  displayName: "凜冬皓月",
  rank: RANK.MASTER
};

async function addMember(env, userId = "member-1", rank = RANK.DISCIPLE) {
  return upsertMember(env, {
    userId,
    username: userId,
    displayName: "小手冰涼脈正常",
    rank
  });
}

test("宗主可訓誡單一正式成員、降低好感並寫入 Audit", async () => {
  const env = createEnv();
  await addMember(env);

  const result = await reprimandPlayer(env, {
    interactionId: "interaction-1",
    actor: master,
    targetUserId: "member-1",
    favorDeduction: 3,
    reason: "在地裡欺負同門"
  });

  assert.equal(result.duplicate, false);
  assert.equal(result.previousFavor, 50);
  assert.equal(result.newFavor, 47);
  assert.equal(result.favorDelta, -3);

  const state = await getPlayerState(env, "member-1");
  assert.equal(state.relationship.favor, 47);
  assert.equal(state.relationship.lastReason, "在地裡欺負同門");

  const [audit] = await listAudits(env);
  assert.equal(audit.action, "laozu.player_reprimanded");
  assert.equal(audit.actorId, "master-1");
  assert.equal(audit.targetId, "member-1");
  assert.deepEqual(audit.details, {
    displayName: "小手冰涼脈正常",
    reason: "在地裡欺負同門",
    previousFavor: 50,
    newFavor: 47,
    favorDelta: -3,
    interactionId: "interaction-1"
  });
});

test("同一 Discord Interaction 重送時不會重複扣分或新增 Audit", async () => {
  const env = createEnv();
  await addMember(env);
  const input = {
    interactionId: "interaction-retry",
    actor: master,
    targetUserId: "member-1",
    favorDeduction: 5,
    reason: "重複事件測試"
  };

  await reprimandPlayer(env, input);
  const duplicate = await reprimandPlayer(env, input);

  assert.equal(duplicate.duplicate, true);
  assert.equal((await getPlayerState(env, "member-1")).relationship.favor, 45);
  assert.equal((await listAudits(env)).length, 1);
});

test("一般成員、宗主目標與非正式成員都不能被錯誤處分", async () => {
  const env = createEnv();
  const disciple = await addMember(env);

  await assert.rejects(
    reprimandPlayer(env, {
      interactionId: "unauthorized",
      actor: disciple,
      targetUserId: "member-1",
      favorDeduction: 1,
      reason: "試圖越權"
    }),
    /只有宗主/
  );

  await assert.rejects(
    reprimandPlayer(env, {
      interactionId: "master-target",
      actor: master,
      targetUserId: "master-1",
      favorDeduction: 1,
      reason: "不應執行"
    }),
    /宗主資料受到保護/
  );

  await assert.rejects(
    reprimandPlayer(env, {
      interactionId: "outsider-target",
      actor: master,
      targetUserId: "outsider-1",
      favorDeduction: 1,
      reason: "不應執行"
    }),
    /正式成員/
  );
});

test("好感扣除只接受 1 至 5，最低不低於 -100", async () => {
  const env = createEnv();
  await addMember(env);

  await assert.rejects(
    reprimandPlayer(env, {
      interactionId: "invalid-score",
      actor: master,
      targetUserId: "member-1",
      favorDeduction: 10,
      reason: "超過限制"
    }),
    /1 至 5/
  );

  const state = await getPlayerState(env, "member-1");
  state.relationship.favor = -99;
  await env.BOT_MEMORY.put("platform:player-state:member-1", JSON.stringify(state));
  const result = await reprimandPlayer(env, {
    interactionId: "floor-score",
    actor: master,
    targetUserId: "member-1",
    favorDeduction: 5,
    reason: "最低值限制"
  });
  assert.equal(result.newFavor, -100);
  assert.equal(result.favorDelta, -1);
});
