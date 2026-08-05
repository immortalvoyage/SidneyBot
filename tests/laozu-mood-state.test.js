import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultLaozuMoodState, publicLaozuMoodState, recordLaozuSignal } from "../src/platform/laozu-mood-state.js";
import { handleLaozuStateRequest } from "../src/integrations/laozu-state.js";

function createEnv() {
  const values = new Map();
  return {
    SIDNEY_STATE_API_TOKEN: "state-token-at-least-32-characters",
    BOT_MEMORY: {
      async get(key) { return values.has(key) ? JSON.parse(values.get(key)) : null; },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    }
  };
}

test("meaningful signals update once and cannot be spammed", async () => {
  const env = createEnv();
  const now = new Date("2026-08-05T08:00:00.000Z");
  const first = await recordLaozuSignal(env, { type: "meaningful_chat", actorId: "member-1", eventId: "chat-1", now });
  const duplicate = await recordLaozuSignal(env, { type: "meaningful_chat", actorId: "member-1", eventId: "chat-1", now });
  assert.equal(first.applied, true);
  assert.equal(first.state.joy, 60);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.state.signalCount, 1);
});

test("public state derives tone and naturally decays", () => {
  const state = createDefaultLaozuMoodState(new Date("2026-08-01T00:00:00Z"));
  state.joy = 95;
  state.fatigue = 5;
  const publicState = publicLaozuMoodState(state, new Date("2026-08-11T00:00:00Z"));
  assert.ok(publicState.joy < 95);
  assert.ok(["playful", "gentle"].includes(publicState.tone));
});

test("state endpoint requires bearer token and exposes no player details", async () => {
  const env = createEnv();
  const denied = await handleLaozuStateRequest(new Request("https://example.com/integrations/laozu-state"), env);
  assert.equal(denied.status, 401);
  const allowed = await handleLaozuStateRequest(new Request("https://example.com/integrations/laozu-state", { headers: { Authorization: `Bearer ${env.SIDNEY_STATE_API_TOKEN}` } }), env);
  const body = await allowed.json();
  assert.equal(body.ok, true);
  assert.equal(body.source, "sidney-discord");
  assert.equal(typeof body.mood.score, "number");
  assert.equal(JSON.stringify(body).includes("member-1"), false);
});
