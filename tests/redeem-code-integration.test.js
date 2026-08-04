import test from "node:test";
import assert from "node:assert/strict";
import { handleRedeemCodeEvent } from "../src/integrations/redeem-codes.js";

function makeKv() {
  const values = new Map();
  return {
    async get(key) { return values.has(key) ? JSON.parse(values.get(key)) : null; },
    async put(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); }
  };
}

async function signature(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function requestFor(secret, body, eventId = "batch-20260804", timestamp = String(Math.floor(Date.now() / 1000))) {
  const raw = JSON.stringify(body);
  return new Request("https://example.com/integrations/redeem-codes", {
    method: "POST",
    headers: {
      "X-Sidney-Timestamp": timestamp,
      "X-Sidney-Event-Id": eventId,
      "X-Sidney-Signature": await signature(secret, `${timestamp}.${eventId}.${raw}`)
    },
    body: raw
  });
}

test("valid tracker event is announced once as the bot", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response("{}", { status: 200 });
  };

  try {
    const secret = "a-secure-shared-secret-with-32-characters";
    const env = {
      BOT_MEMORY: makeKv(), REDEEM_TRACKER_SECRET: secret,
      DISCORD_BOT_TOKEN: "test-token", REDEEM_CODE_CHANNEL_ID: "1234567890"
    };
    const payload = { codes: ["gift123", "GIFT123", "SECOND"], activeCount: 9 };
    const first = await handleRedeemCodeEvent(await requestFor(secret, payload), env);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).announced, 2);
    assert.equal(calls.length, 1);
    assert.match(JSON.parse(calls[0].options.body).content, /老祖發現新的/);

    const duplicate = await handleRedeemCodeEvent(await requestFor(secret, payload), env);
    assert.deepEqual(await duplicate.json(), { ok: true, duplicate: true });
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("invalid signature and expired timestamp are rejected", async () => {
  const secret = "a-secure-shared-secret-with-32-characters";
  const env = { BOT_MEMORY: makeKv(), REDEEM_TRACKER_SECRET: secret };
  const bad = await requestFor(secret, { codes: ["TEST"] });
  bad.headers.set("X-Sidney-Signature", "00");
  assert.equal((await handleRedeemCodeEvent(bad, env)).status, 401);

  const old = String(Math.floor(Date.now() / 1000) - 1000);
  assert.equal((await handleRedeemCodeEvent(await requestFor(secret, { codes: ["TEST"] }, "old-batch", old), env)).status, 401);
});

test("signed connection test sends a non-code message as Laozu", async () => {
  const originalFetch = globalThis.fetch;
  const messages = [];
  globalThis.fetch = async (_url, options) => {
    messages.push(JSON.parse(options.body));
    return new Response("{}", { status: 200 });
  };

  try {
    const secret = "connection-test-secret-at-least-32-characters";
    const env = {
      BOT_MEMORY: makeKv(), REDEEM_TRACKER_SECRET: secret,
      DISCORD_BOT_TOKEN: "test-token", REDEEM_CODE_CHANNEL_ID: "1234567890"
    };
    const response = await handleRedeemCodeEvent(
      await requestFor(secret, { type: "connection_test", source: "wwm-redeem-code-tracker" }, "connection-test-1"),
      env
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, connectionTest: true });
    assert.equal(messages.length, 1);
    assert.match(messages[0].content, /老祖連線測試成功/);
    assert.match(messages[0].content, /不是新兌換碼公告/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
