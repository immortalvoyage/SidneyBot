import test from "node:test";
import assert from "node:assert/strict";
import { handlePanel } from "../src/commands/panel.js";

function interaction(type, channelId = "1534238116099919933") {
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
    MASTER_ADMIN_CHANNEL_ID: "wrong-config-must-not-open-admin-panel",
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

test("explicit greeting type creates daily greeting panel and silently clears success confirmation", async () => {
  const originalFetch = globalThis.fetch;
  let body;
  const deletes = [];
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === "DELETE") {
      deletes.push(options.method);
      return new Response(null, { status: 204 });
    }
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ id: "message-1" }) };
  };

  try {
    const pending = [];
    const response = await handlePanel(interaction("greeting"), env(), {
      waitUntil(task) { pending.push(task); }
    });
    const responseBody = await response.json();
    await Promise.all(pending);

    assert.match(body.content, /老祖每日請安/);
    assert.equal(body.components[0].components[0].custom_id, "sidney:greeting:v1");
    assert.equal(responseBody.type, 5);
    assert.equal(responseBody.data.flags, 64);
    assert.deepEqual(deletes, ["DELETE"]);
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
    assert.match(body.content, /宗主管理中心/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("explicit admin panel is rejected outside the fixed master approval channel", async () => {
  const response = await handlePanel(interaction("admin", "other-channel"), env());
  const responseBody = await response.json();
  assert.match(responseBody.data.content, /只能建立在宗主審批私人頻道/);
  assert.equal(responseBody.data.flags, 64);
});
