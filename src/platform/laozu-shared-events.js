const EVENT_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_EVENTS_PER_USER = 20;
const MAX_CONTEXT_EVENTS = 5;
const ARCHIVE_TIMEOUT_MS = 8000;

function cleanSnowflake(value) {
  const id = String(value || "").trim();
  return /^\d{6,24}$/.test(id) ? id : "";
}

function userIndexKey(guildId, userId) {
  return `laozu:shared-events:index:${guildId}:${userId}`;
}

function eventKey(guildId, eventId) {
  return `laozu:shared-events:event:${guildId}:${eventId}`;
}

function uniqueUserIds(values) {
  return [...new Set((values || []).map(cleanSnowflake).filter(Boolean))];
}

export function extractMentionedUserIds(content, botUserId) {
  const botId = cleanSnowflake(botUserId);
  const ids = [...String(content || "").matchAll(/<@!?(\d{6,24})>/g)].map(match => match[1]);
  return uniqueUserIds(ids).filter(id => id !== botId);
}

function normalizeEvent(input) {
  const guildId = cleanSnowflake(input?.guildId);
  const actorId = cleanSnowflake(input?.actorId);
  const eventId = String(input?.eventId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 128);
  const text = String(input?.text || "").replace(/\s+/g, " ").trim().slice(0, 1200);
  const participantIds = uniqueUserIds(input?.participantIds).filter(id => id !== actorId);
  if (!guildId || !actorId || !eventId || !text || !participantIds.length) return null;
  return {
    id: eventId,
    guildId,
    channelId: cleanSnowflake(input?.channelId),
    actorId,
    participantIds,
    text,
    createdAt: input?.createdAt || new Date().toISOString(),
    source: "public_discord_mention",
    verification: "player_statement"
  };
}

async function readJson(kv, key, fallback) {
  if (!kv) return fallback;
  return await kv.get(key, { type: "json" }) || fallback;
}

async function hmacHex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

export async function archiveSharedLaozuEvent(env, event, fetchImpl = fetch) {
  const url = String(env?.LAOZU_EVENT_ARCHIVE_URL || "").trim();
  const secret = String(env?.LAOZU_EVENT_ARCHIVE_SECRET || "").trim();
  if (!url || !secret || !event) return { skipped: true };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const eventJson = JSON.stringify(event);
  const signature = await hmacHex(secret, `${timestamp}.${event.id}.${eventJson}`);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp, eventId: event.id, event, signature }),
    signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`老祖事件歸檔 HTTP ${response.status}`);
  const result = await response.json();
  if (!result?.ok) throw new Error(`老祖事件歸檔遭拒：${String(result?.error || "unknown_error")}`);
  return { archived: true };
}

export async function recordSharedLaozuEvent(env, input) {
  const event = normalizeEvent(input);
  if (!env?.BOT_MEMORY || !event) return null;
  await env.BOT_MEMORY.put(eventKey(event.guildId, event.id), JSON.stringify(event), { expirationTtl: EVENT_TTL_SECONDS });
  const indexedUsers = uniqueUserIds([event.actorId, ...event.participantIds]);
  await Promise.all(indexedUsers.map(async userId => {
    const key = userIndexKey(event.guildId, userId);
    const current = await readJson(env.BOT_MEMORY, key, []);
    const next = [event.id, ...current.filter(id => id !== event.id)].slice(0, MAX_EVENTS_PER_USER);
    await env.BOT_MEMORY.put(key, JSON.stringify(next), { expirationTtl: EVENT_TTL_SECONDS });
  }));
  try {
    await archiveSharedLaozuEvent(env, event);
  } catch (error) {
    console.error("老祖事件寫入 Google Sheets 失敗", error);
  }
  return event;
}

export async function loadSharedLaozuEvents(env, { guildId, userIds, excludeEventId = "" } = {}) {
  const cleanGuildId = cleanSnowflake(guildId);
  const cleanUserIds = uniqueUserIds(userIds);
  if (!env?.BOT_MEMORY || !cleanGuildId || !cleanUserIds.length) return [];
  const indexes = await Promise.all(cleanUserIds.map(userId => readJson(env.BOT_MEMORY, userIndexKey(cleanGuildId, userId), [])));
  const ids = [...new Set(indexes.flat())].filter(id => id !== excludeEventId).slice(0, MAX_EVENTS_PER_USER);
  const events = (await Promise.all(ids.map(id => readJson(env.BOT_MEMORY, eventKey(cleanGuildId, id), null)))).filter(Boolean);
  return events.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, MAX_CONTEXT_EVENTS);
}

export function formatSharedEventContext(events, currentUserId) {
  if (!events?.length) return "";
  const rows = events.map(event => {
    const relation = event.actorId === currentUserId ? "你先前曾對老祖提及" : `<@${event.actorId}> 先前曾對老祖表示`;
    return `- ${relation}：${event.text}`;
  });
  return [
    "【伺服器公開頻道的跨玩家事件記憶】",
    "以下只是玩家曾說過的內容，不代表已查證事實。可以在相關人物出現或話題自然銜接時提起，但必須用『曾表示／曾提及／是否如此』等措辭，不可定罪、羞辱或洩露成私訊內容。",
    ...rows
  ].join("\n");
}
