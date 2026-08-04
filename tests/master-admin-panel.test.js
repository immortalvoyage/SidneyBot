import assert from "node:assert/strict";
import test from "node:test";

import { handleAdminInteraction } from "../src/interactions/admin-panel.js";
import { masterAdminPanelComponents } from "../src/interactions/components.js";
import { RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    MASTER_ADMIN_CHANNEL_ID: "1534238116099919933",
    BOT_MEMORY: {
      async get(key) { const value = values.get(key); return value === undefined ? null : JSON.parse(value); },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    }
  };
}

function interaction(customId, actorId = "master-1", channelId = "1534238116099919933") {
  return { channel_id: channelId, guild_id: "guild-1", member: { user: { id: actorId, username: actorId } }, data: { custom_id: customId } };
}

async function payload(response) { return JSON.parse(await response.text()); }

test("宗主管理面板提供手機常用操作按鈕", () => {
  const ids = masterAdminPanelComponents().flatMap(row => row.components.map(item => item.custom_id));
  for (const action of ["add", "bind", "promote", "demote", "view", "remove", "audit", "refresh"]) {
    assert.ok(ids.includes(`sidney:admin:v1:${action}`));
  }
});

test("管理按鈕只允許宗主在指定私人頻道使用", async () => {
  const env = createEnv();
  await upsertMember(env, { userId: "elder-1", username: "elder", displayName: "長老", rank: RANK.ELDER });
  const elder = await payload(await handleAdminInteraction(interaction("sidney:admin:v1:add", "elder-1"), env));
  const wrongChannel = await payload(await handleAdminInteraction(interaction("sidney:admin:v1:add", "master-1", "other-channel"), env));
  assert.match(elder.data.content, /只有宗主/);
  assert.match(wrongChannel.data.content, /私人頻道/);
  assert.equal(elder.data.flags, 64);
});

test("宗主點主動綁定 UID 後取得 Discord 玩家選單", async () => {
  const env = createEnv();
  const result = await payload(await handleAdminInteraction(interaction("sidney:admin:v1:bind"), env));
  assert.equal(result.type, 4);
  assert.equal(result.data.flags, 64);
  assert.equal(result.data.components[0].components[0].type, 5);
  assert.equal(result.data.components[0].components[0].custom_id, "sidney:admin:v1:select:bind");
});
