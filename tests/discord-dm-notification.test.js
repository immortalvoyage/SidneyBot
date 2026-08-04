import assert from "node:assert/strict";
import test from "node:test";

import { sendUserDirectMessage } from "../discord.js";
import { listAudits } from "../src/sect/audit.js";
import { notifyMember } from "../src/sect/notifications.js";

function createEnv() {
  const values = new Map();
  return {
    DISCORD_BOT_TOKEN: "token-1",
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

test("私人訊息先建立 DM 頻道再由老祖送出訊息", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    const body = url.endsWith("/users/@me/channels")
      ? { id: "dm-channel-1" }
      : { id: "dm-message-1" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  try {
    await sendUserDirectMessage("123456789012345678", "token-1", "入宗結果");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://discord.com/api/v10/users/@me/channels");
  assert.deepEqual(JSON.parse(requests[0].init.body), { recipient_id: "123456789012345678" });
  assert.equal(requests[1].url, "https://discord.com/api/v10/channels/dm-channel-1/messages");
});

test("玩家關閉私訊時不回滾成員操作並記錄通知失敗", async () => {
  const env = createEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Cannot send messages to this user", { status: 403 });
  let result;
  try {
    result = await notifyMember(env, {
      userId: "123456789012345678",
      actorId: "master-1",
      event: "application.approved",
      content: "已核准"
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(result.status, "failed");
  const [audit] = await listAudits(env);
  assert.equal(audit.action, "discord.dm_notification");
  assert.equal(audit.details.status, "failed");
});
