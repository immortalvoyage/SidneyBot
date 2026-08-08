import assert from "node:assert/strict";
import test from "node:test";

import { handleAdminInteraction } from "../src/interactions/admin-panel.js";
import { recordCapabilitySuggestion } from "../src/platform/laozu-autonomy.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    MASTER_ADMIN_CHANNEL_ID: "1534238116099919933",
    BOT_MEMORY: {
      async get(key, options) {
        const value = values.get(key);
        return options?.type === "json" && value ? JSON.parse(value) : value ?? null;
      },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); },
      async list({ prefix, limit = 100 }) {
        return { keys: [...values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(name => ({ name })) };
      }
    }
  };
}

function interaction(customId) {
  return {
    channel_id: "1534238116099919933",
    guild_id: "guild-1",
    member: { user: { id: "master-1", username: "master" } },
    data: { custom_id: customId }
  };
}

async function body(response) { return JSON.parse(await response.text()); }

test("能力建議面板一次只顯示一筆且操作按鈕明確綁定該筆", async () => {
  const env = createEnv();
  const first = await recordCapabilitySuggestion(env, { text: "幫忙管理活動報名", userId: "1", guildId: "guild-1" });
  const second = await recordCapabilitySuggestion(env, { text: "請修正專長更新的 BUG", userId: "2", guildId: "guild-1" });
  const result = await body(await handleAdminInteraction(interaction("sidney:admin:v1:capabilities"), env));
  assert.match(result.data.content, /第 1／2 筆/);
  assert.equal(result.data.content.includes(first.text) || result.data.content.includes(second.text), true);
  assert.equal(result.data.content.includes(first.text) && result.data.content.includes(second.text), false);
  assert.deepEqual(result.data.components[0].components.map(button => button.label), ["此筆｜標記已開發", "此筆｜拒絕"]);
  assert.deepEqual(result.data.components[1].components.map(button => button.label), ["上一筆", "下一筆", "稍後處理"]);
});

test("切換能力建議時卡片與按鈕一起更新", async () => {
  const env = createEnv();
  const first = await recordCapabilitySuggestion(env, { text: "幫忙管理活動報名", userId: "1", guildId: "guild-1" });
  const second = await recordCapabilitySuggestion(env, { text: "請修正專長更新的 BUG", userId: "2", guildId: "guild-1" });
  const result = await body(await handleAdminInteraction(interaction(`sidney:admin:v1:capability-page:${second.id}`), env));
  assert.match(result.data.content, new RegExp(second.text));
  assert.doesNotMatch(result.data.content, new RegExp(first.text));
  assert.ok(result.data.components[0].components.every(button => button.custom_id.includes(second.id)));
});
