import test from "node:test";
import assert from "node:assert/strict";
import { handlePanel } from "../src/commands/panel.js";

function interaction(type, channelId = "master-channel") {
  return {
    channel_id: channelId,
    member: { user: { id: "master-user", username: "master" } },
    data: {
      name: "panel",
      options: type ? [{ name: "type", value: type }] : []
    }
  };
}

function env() {
  const values = new Map();
  return {
    MASTER_ADMIN_CHANNEL_ID: "master-channel",
    SECT_MASTER_ID: "master-user",
    DISCORD_BOT_TOKEN: "test-token",
    DISCORD_API_BASE: "https://discord.test/api/v10",
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

test("explicit greeting type creates daily greeting panel even in master admin channel", async () => {
  const originalFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ id: "message-1" }) };
  };

  try {
    const response = await handlePanel(interaction("greeting"), env());
    const responseBody = await response.json();

    assert.match(body.content, /老祖每日請安/);
    assert.equal(body.components[0].components[0].custom_id, "sidney:greeting:v1");
    assert.match(responseBody.data.content, /每日請安面板已建立/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bare /panel preserves the existing admin-channel behavior", async () => {
  const originalFetch = globalThis.fetch;
  let body;
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ id: "message-1" }) };
  };

  try {
    await handlePanel(interaction(undefined), env());
    assert.match(body.content, /宗主管理面板/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
