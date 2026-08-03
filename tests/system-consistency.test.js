import assert from "node:assert/strict";
import test from "node:test";

import { handleCommand } from "../commands.js";
import { inspectKvConsistency, repairKvConsistency } from "../src/sect/consistency.js";
import { KV, RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    APP_VERSION: "4.2.18",
    BOT_MEMORY: {
      async get(key) {
        const value = values.get(key);
        return value === undefined ? null : JSON.parse(value);
      },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); },
      async list({ prefix = "", cursor } = {}) {
        assert.equal(cursor, undefined);
        return {
          keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })),
          list_complete: true
        };
      }
    },
    _values: values
  };
}

function interaction(userId, action, confirm = null) {
  return {
    data: {
      name: "system",
      options: [{
        name: action,
        type: 1,
        options: confirm ? [{ name: "confirm", type: 3, value: confirm }] : []
      }]
    },
    member: { user: { id: userId, username: userId } }
  };
}

async function payload(response) { return response.json(); }

test("一致性檢查可找出漏列、失效與重複索引", async () => {
  const env = createEnv();
  env._values.set(KV.MEMBER("member-1"), JSON.stringify({ userId: "member-1", rank: RANK.DISCIPLE }));
  env._values.set(KV.MEMBER_INDEX, JSON.stringify(["ghost-1", "ghost-1"]));

  const report = await inspectKvConsistency(env);
  assert.equal(report.healthy, false);
  const members = report.checks.find(item => item.indexKey === KV.MEMBER_INDEX);
  assert.deepEqual(members.missingFromIndex, ["member-1"]);
  assert.deepEqual(members.staleIndexEntries, ["ghost-1"]);
  assert.equal(members.duplicateEntries, 1);
});

test("修復只重建索引並保留實體資料", async () => {
  const env = createEnv();
  env._values.set(KV.MEMBER("member-1"), JSON.stringify({ userId: "member-1", rank: RANK.DISCIPLE }));
  env._values.set(KV.MEMBER_INDEX, JSON.stringify(["ghost-1"]));

  const result = await repairKvConsistency(env, "master-1");
  assert.equal(result.changedCount, 1);
  assert.deepEqual(JSON.parse(env._values.get(KV.MEMBER_INDEX)), ["member-1"]);
  assert.ok(env._values.has(KV.MEMBER("member-1")));
  const after = await inspectKvConsistency(env);
  assert.equal(after.healthy, true);
});

test("/system 僅宗主可用，修復需要明確確認", async () => {
  const env = createEnv();
  await upsertMember(env, { userId: "member-1", displayName: "弟子", rank: RANK.DISCIPLE });

  const denied = await payload(await handleCommand(interaction("member-1", "check"), env, {}));
  assert.match(denied.data.content, /只有宗主/);

  const missingConfirm = await payload(await handleCommand(interaction("master-1", "repair"), env, {}));
  assert.match(missingConfirm.data.content, /確認修復索引/);

  const checked = await payload(await handleCommand(interaction("master-1", "check"), env, {}));
  assert.equal(checked.data.flags, 64);
  assert.match(checked.data.content, /KV 索引一致性正常/);
});
