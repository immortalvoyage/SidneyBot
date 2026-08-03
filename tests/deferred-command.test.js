import test from "node:test";
import assert from "node:assert/strict";
import { runDeferredCommand } from "../src/commands/deferred.js";

function interaction() {
  return { application_id: "app-1", token: "token-1" };
}

test("耗時管理操作先回覆私密 deferred，再更新原訊息", async () => {
  const pending = [];
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init });
    return new Response("{}", { status: 200 });
  };

  try {
    const response = await runDeferredCommand(
      interaction(),
      { waitUntil(promise) { pending.push(promise); } },
      "測試操作",
      async () => "✅ 操作完成"
    );
    const payload = await response.json();

    assert.equal(payload.type, 5);
    assert.equal(payload.data.flags, 64);
    assert.equal(pending.length, 1);
    await pending[0];
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /messages\/@original$/);
    assert.equal(JSON.parse(requests[0].init.body).content, "✅ 操作完成");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("背景操作失敗時會更新原私密訊息，不留下無回應狀態", async () => {
  const pending = [];
  const bodies = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  };

  try {
    const response = await runDeferredCommand(
      interaction(),
      { waitUntil(promise) { pending.push(promise); } },
      "測試操作",
      async () => { throw new Error("權限已變更"); }
    );

    assert.equal((await response.json()).type, 5);
    await pending[0];
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0].content, "❌ 權限已變更");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("無 Worker execution context 時維持可測試的即時回覆", async () => {
  const response = await runDeferredCommand(
    interaction(),
    null,
    "測試操作",
    async () => "✅ 本機完成"
  );
  const payload = await response.json();
  assert.equal(payload.type, 4);
  assert.equal(payload.data.flags, 64);
  assert.equal(payload.data.content, "✅ 本機完成");
});
