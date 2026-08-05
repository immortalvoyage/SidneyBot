import { getLaozuMoodState, publicLaozuMoodState } from "../platform/laozu-mood-state.js";

export async function handleLaozuStateRequest(request, env) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const expected = String(env.SIDNEY_STATE_API_TOKEN || "");
  if (!expected) return json({ error: "integration_not_configured" }, 503);
  const provided = String(request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!constantTimeEqual(expected, provided)) return json({ error: "unauthorized" }, 401);
  const now = new Date();
  const state = publicLaozuMoodState(await getLaozuMoodState(env, now), now);
  return json({ ok: true, source: "sidney-discord", updatedAt: state.updatedAt, mood: state }, 200, { "Cache-Control": "private, max-age=60" });
}

function constantTimeEqual(left, right) {
  if (!left || left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

function json(value, status, extraHeaders = {}) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=UTF-8", ...extraHeaders } });
}

