import assert from "node:assert/strict";
import test from "node:test";

import { handleCommand } from "../commands.js";
import { handleHelpInteraction } from "../src/interactions/help-panel.js";
import { canUseCommand, listCommandPolicies, setCommandRoles } from "../src/commands/command-access.js";
import { RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    SECT_NAME: "仙遊者",
    BOT_MEMORY: {
      async get(key) { const value = values.get(key); return value === undefined ? null : JSON.parse(value); },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    }
  };
}

function slash(userId) {
  return { data: { name: "help" }, member: { user: { id: userId, username: userId } } };
}

async function payload(response) { return response.json(); }

test("/help 對所有身分提供私人按鈕式指令中心", async () => {
  const data = await payload(await handleCommand(slash("outsider-1"), createEnv(), {}));
  assert.equal(data.data.flags, 64);
  assert.match(data.data.content, /指令中心/);
  assert.match(data.data.content, /尚未入宗/);
  assert.match(data.data.content, /\/apply/);
  assert.ok(data.data.components.flatMap(row => row.components).some(item => item.custom_id === "immortalvoyage:help:v1:basic"));
});

test("help 按鈕會依身分更新分類且不公開回覆", async () => {
  const env = createEnv();
  await upsertMember(env, { userId: "resident-1", displayName: "領民", rank: RANK.RESIDENT });
  const data = await payload(await handleHelpInteraction({
    data: { custom_id: "immortalvoyage:help:v1:game" },
    member: { user: { id: "resident-1", username: "resident" } }
  }, env));
  assert.equal(data.type, 7);
  assert.match(data.data.content, /遊戲綁定/);
  assert.match(data.data.content, /\/game/);
  assert.doesNotMatch(data.data.content, /\/member/);
});

test("預設權限目錄沒有重複主指令且記錄 help 刊登分類", async () => {
  const policies = await listCommandPolicies(createEnv());
  assert.equal(new Set(policies.map(item => item.name)).size, policies.length);
  assert.ok(policies.every(item => item.help && item.roles.length));
  assert.equal(policies.length, 14);
});

test("宗主修改身分後會同步影響實際可執行權限", async () => {
  const env = createEnv();
  assert.equal(await canUseCommand(env, "ai", RANK.RESIDENT), true);
  await setCommandRoles(env, "ai", [RANK.DISCIPLE, RANK.ELDER, RANK.MASTER]);
  assert.equal(await canUseCommand(env, "ai", RANK.RESIDENT), false);
  assert.equal(await canUseCommand(env, "ai", RANK.DISCIPLE), true);
});

test("玩家看不到沒有權限的管理指令", async () => {
  const env = createEnv();
  await upsertMember(env, { userId: "disciple-1", displayName: "門徒", rank: RANK.DISCIPLE });
  const data = await payload(await handleCommand(slash("disciple-1"), env, {}));
  assert.match(data.data.content, /\/ai/);
  assert.doesNotMatch(data.data.content, /\/audit|\/system|\/member(?:\\s|$)/);
});
