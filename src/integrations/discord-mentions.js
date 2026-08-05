import { askGemini } from "../../gemini.js";
import { loadMemory, loadProfile, saveMemory } from "../../memory.js";
import { getMember } from "../sect/members.js";
import { canUseAI } from "../sect/permissions.js";
import { getPlayerState } from "../platform/player-state-storage.js";
import { recordLaozuSignal } from "../platform/laozu-mood-state.js";

const MAX_AGE_SECONDS = 300;

export function extractMentionQuestion(content, botUserId) {
  const id = String(botUserId || "").trim();
  if (!/^\d+$/.test(id)) return "";
  return String(content || "")
    .replace(new RegExp(`<@!?${id}>`, "g"), " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1800);
}

export async function handleDiscordMentionEvent(request, env) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = String(env.DISCORD_GATEWAY_SECRET || "");
  if (!secret) return json({ error: "integration_not_configured" }, 503);

  const body = await request.text();
  const timestamp = request.headers.get("X-Sidney-Timestamp") || "";
  const eventId = cleanId(request.headers.get("X-Sidney-Event-Id"));
  const signature = String(request.headers.get("X-Sidney-Signature") || "").toLowerCase();
  if (!eventId || !validTimestamp(timestamp)) return json({ error: "invalid_or_expired_request" }, 401);
  const expected = await hmacHex(secret, `${timestamp}.${eventId}.${body}`);
  if (!constantTimeEqual(expected, signature)) return json({ error: "invalid_signature" }, 401);

  let payload;
  try { payload = JSON.parse(body); } catch { return json({ error: "invalid_json" }, 400); }
  const guildId = cleanSnowflake(payload.guildId) || "dm";
  const userId = cleanSnowflake(payload.userId);
  const botUserId = cleanSnowflake(payload.botUserId);
  const question = extractMentionQuestion(payload.content, botUserId);
  if (!userId || !question) return json({ error: "message_required" }, 400);

  const dedupeKey = `integration:discord-mention:event:${eventId}`;
  if (await env.BOT_MEMORY?.get(dedupeKey)) return json({ ok: true, duplicate: true });

  const member = await getMember(env, userId);
  if (!member || !canUseAI(member.rank)) {
    return json({ ok: false, reply: "你目前還不能呼叫老祖。請先使用 `/apply` 申請加入仙遊者。" }, 403);
  }

  const [history, profile, playerState] = await Promise.all([
    loadMemory(env, guildId, userId),
    loadProfile(env, guildId, userId),
    getPlayerState(env, userId)
  ]);
  const answer = await askGemini(question, env, history, profile, member, playerState);
  await saveMemory(env, guildId, userId, question, answer);
  await recordLaozuSignal(env, {
    type: "meaningful_chat",
    actorId: userId,
    eventId: `mention-chat:${userId}:${new Date().toISOString().slice(0, 10)}`
  });
  await env.BOT_MEMORY?.put(dedupeKey, JSON.stringify({ receivedAt: new Date().toISOString() }), { expirationTtl: 86400 });
  return json({ ok: true, reply: answer });
}

function cleanSnowflake(value) { const id = String(value || "").trim(); return /^\d{6,24}$/.test(id) ? id : ""; }
function cleanId(value) { const id = String(value || "").trim(); return /^[A-Za-z0-9_-]{8,128}$/.test(id) ? id : ""; }
function validTimestamp(value) { return /^\d{10}$/.test(value) && Math.abs(Math.floor(Date.now() / 1000) - Number(value)) <= MAX_AGE_SECONDS; }
async function hmacHex(secret, message) { const encoder = new TextEncoder(); const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message))); return [...bytes].map(value => value.toString(16).padStart(2, "0")).join(""); }
function constantTimeEqual(left, right) { if (!left || left.length !== right.length) return false; let diff = 0; for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i); return diff === 0; }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" } }); }
