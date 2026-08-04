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
    DISCORD_BOT_TOKEN: "test-token",
    DISCORD_RESIDENT_ROLE_ID: "role-resident",
    DISCORD_DISCIPLE_ROLE_ID: "role-disciple",
    DISCORD_ELDER_ROLE_ID: "role-elder",
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

test("主動綁定 UID 選單只顯示尚未綁定的領民", async () => {
  const env = createEnv();
  await upsertMember(env, { userId: "100", username: "resident", displayName: "待綁定領民", rank: RANK.RESIDENT });
  await upsertMember(env, { userId: "101", username: "disciple", displayName: "夏之雪", rank: RANK.DISCIPLE });
  const result = await payload(await handleAdminInteraction(interaction("sidney:admin:v1:bind"), env));
  assert.equal(result.type, 4);
  assert.equal(result.data.flags, 64);
  const menu = result.data.components[0].components[0];
  assert.equal(menu.type, 3);
  assert.equal(menu.custom_id, "sidney:admin:v1:select-candidate:bind:0");
  assert.deepEqual(menu.options.map(option => option.value), ["100"]);
  assert.ok(!menu.options.some(option => option.value === "101"));
});

test("選擇合格領民後可正常開啟 UID 綁定表單", async () => {
  const env = createEnv();
  await upsertMember(env, { userId: "100", username: "resident", displayName: "待綁定領民", rank: RANK.RESIDENT });
  const selected = interaction("sidney:admin:v1:select-candidate:bind:0");
  selected.data.values = ["100"];
  const result = await payload(await handleAdminInteraction(selected, env, { waitUntil() { throw new Error("綁定選擇不可延遲，否則 Discord 無法開啟 Modal"); } }));
  assert.equal(result.type, 9);
  assert.equal(result.data.custom_id, "sidney:admin:v1:modal:bind:100");
});

test("新增領民選單排除已有仙遊者身分組、宗主與機器人", async () => {
  const env = createEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.match(String(url), /\/guilds\/guild-1\/members\?/);
    return new Response(JSON.stringify([
      { user: { id: "100", username: "new-player", global_name: "新玩家" }, roles: [] },
      { user: { id: "101", username: "resident" }, roles: ["role-resident"] },
      { user: { id: "102", username: "disciple" }, roles: ["role-disciple"] },
      { user: { id: "103", username: "elder" }, roles: ["role-elder"] },
      { user: { id: "master-1", username: "master" }, roles: [] },
      { user: { id: "104", username: "bot", bot: true }, roles: [] }
    ]), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await payload(await handleAdminInteraction(interaction("sidney:admin:v1:add"), env));
    const menu = result.data.components[0].components[0];
    assert.equal(menu.type, 3);
    assert.equal(menu.custom_id, "sidney:admin:v1:select-candidate:add:0");
    assert.deepEqual(menu.options.map(option => option.value), ["100"]);
    assert.match(result.data.content, /共有 1 位/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("宗主主動綁定 UID 的 Modal 會先延遲回覆，完成後顯示成功且可安全重送", async () => {
  const env = createEnv();
  await upsertMember(env, { userId: "resident-1", username: "resident", displayName: "領民一號", rank: RANK.RESIDENT });
  const edits = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    if (target.includes("/guilds/guild-1/members/resident-1")) {
      return new Response(JSON.stringify({ roles: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (target.endsWith("/users/@me/channels")) {
      return new Response(JSON.stringify({ id: "dm-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (target.includes("/channels/dm-1/messages")) {
      return new Response(JSON.stringify({ id: "message-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (target.includes("/webhooks/app-1/token-1/messages/@original")) {
      edits.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: "original" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`未預期的測試請求：${target}`);
  };

  const modal = {
    ...interaction("sidney:admin:v1:modal:bind:resident-1"),
    application_id: "app-1",
    token: "token-1",
    data: {
      custom_id: "sidney:admin:v1:modal:bind:resident-1",
      components: [
        { components: [{ custom_id: "uid", value: "3027610763" }] },
        { components: [{ custom_id: "character_name", value: "o夏之雪o" }] }
      ]
    }
  };

  try {
    const pending = [];
    const first = await payload(await handleAdminInteraction(modal, env, { waitUntil(task) { pending.push(task); } }));
    assert.equal(first.type, 5);
    assert.equal(first.data.flags, 64);
    await Promise.all(pending);
    assert.match(edits.at(-1).content, /已綁定.*3027610763.*升為門徒/);

    const secondPending = [];
    const second = await payload(await handleAdminInteraction(modal, env, { waitUntil(task) { secondPending.push(task); } }));
    assert.equal(second.type, 5);
    await Promise.all(secondPending);
    assert.match(edits.at(-1).content, /先前已成功綁定.*未重複寫入/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
