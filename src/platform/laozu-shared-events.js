const EVENT_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_EVENTS_PER_USER = 20;
const MAX_CONTEXT_EVENTS = 5;
const MAX_ARCHIVE_CONTEXT_EVENTS = 12;
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

function privacyKey(guildId, userId) {
  return `laozu:shared-events:privacy:${guildId}:${userId}`;
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
  if (!guildId || !actorId || !eventId || !text) return null;
  const scope = input?.scope === "private" || guildId === "dm" ? "private" : "public";
  return {
    id: eventId,
    guildId,
    channelId: cleanSnowflake(input?.channelId),
    actorId,
    participantIds,
    text,
    scope,
    observations: buildBehaviorObservations(text),
    createdAt: input?.createdAt || new Date().toISOString(),
    source: "public_discord_mention",
    verification: "player_statement"
  };
}

export function buildBehaviorObservations(text) {
  const value = String(text || "");
  const compact = value.replace(/\s+/g, " ").trim();
  const signals = [];
  if (/[?？]/.test(compact)) signals.push("asks_question");
  if (/(謝謝|感謝|辛苦|麻煩)/i.test(compact)) signals.push("expresses_appreciation");
  if (/(抱歉|對不起|不好意思)/i.test(compact)) signals.push("apologizes");
  if (/(同意|確認|可以|好|OK|GO)/i.test(compact)) signals.push("confirms_or_agrees");
  if (/(不同意|不要|拒絕|不行|停止)/i.test(compact)) signals.push("sets_boundary_or_disagrees");
  if (/(工作|兼職|接案|專長|能力)/i.test(compact)) signals.push("career_or_capability_topic");
  if (/(生氣|難過|開心|焦慮|擔心|害怕|煩)/i.test(compact)) signals.push("emotion_self_report");
  return {
    schemaVersion: 1,
    characterCount: [...compact].length,
    questionCount: (compact.match(/[?？]/g) || []).length,
    exclamationCount: (compact.match(/[!！]/g) || []).length,
    mentionCount: (compact.match(/<@!?\d{6,24}>/g) || []).length,
    signals
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
  const payload = { action: "append", event };
  const payloadJson = JSON.stringify(payload);
  const signature = await hmacHex(secret, `${timestamp}.${event.id}.${payloadJson}`);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp, requestId: event.id, payload, signature }),
    signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`老祖事件歸檔 HTTP ${response.status}`);
  const result = await response.json();
  if (!result?.ok) throw new Error(`老祖事件歸檔遭拒：${String(result?.error || "unknown_error")}`);
  return { archived: true };
}

export async function queryArchivedLaozuEvents(env, { guildId, requesterId, userIds, limit = MAX_ARCHIVE_CONTEXT_EVENTS } = {}, fetchImpl = fetch) {
  const url = String(env?.LAOZU_EVENT_ARCHIVE_URL || "").trim();
  const secret = String(env?.LAOZU_EVENT_ARCHIVE_SECRET || "").trim();
  const cleanGuildId = cleanSnowflake(guildId);
  const cleanRequesterId = cleanSnowflake(requesterId);
  const cleanUserIds = uniqueUserIds(userIds);
  if (!url || !secret || !cleanGuildId || !cleanRequesterId || !cleanUserIds.length) return [];
  const timestamp = String(Math.floor(Date.now() / 1000));
  const requestId = `query-${cleanRequesterId}-${timestamp}`;
  const payload = { action: "query", guildId: cleanGuildId, requesterId: cleanRequesterId, userIds: cleanUserIds, limit: Math.min(MAX_ARCHIVE_CONTEXT_EVENTS, Math.max(1, Number(limit) || 5)) };
  const payloadJson = JSON.stringify(payload);
  const signature = await hmacHex(secret, `${timestamp}.${requestId}.${payloadJson}`);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp, requestId, payload, signature }),
    signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`老祖事件查詢 HTTP ${response.status}`);
  const result = await response.json();
  if (!result?.ok || !Array.isArray(result.events)) throw new Error(`老祖事件查詢遭拒：${String(result?.error || "unknown_error")}`);
  return result.events;
}

export async function getLaozuMemoryPrivacy(env, { guildId, userId } = {}) {
  const cleanGuildId = cleanSnowflake(guildId);
  const cleanUserId = cleanSnowflake(userId);
  if (!env?.BOT_MEMORY || !cleanGuildId || !cleanUserId) return { sharePublicEvents: true };
  const saved = await readJson(env.BOT_MEMORY, privacyKey(cleanGuildId, cleanUserId), null);
  return { sharePublicEvents: saved?.sharePublicEvents !== false };
}

export async function setLaozuMemorySharing(env, { guildId, userId, enabled } = {}) {
  const cleanGuildId = cleanSnowflake(guildId);
  const cleanUserId = cleanSnowflake(userId);
  if (!env?.BOT_MEMORY || !cleanGuildId || !cleanUserId) return null;
  const value = { sharePublicEvents: enabled === true, updatedAt: new Date().toISOString() };
  await env.BOT_MEMORY.put(privacyKey(cleanGuildId, cleanUserId), JSON.stringify(value));
  return value;
}

export async function deleteOwnLaozuEvents(env, { guildId, userId } = {}, fetchImpl = fetch) {
  const cleanGuildId = cleanSnowflake(guildId);
  const cleanUserId = cleanSnowflake(userId);
  if (!env?.BOT_MEMORY || !cleanGuildId || !cleanUserId) return { deleted: 0, archived: false };
  const indexKey = userIndexKey(cleanGuildId, cleanUserId);
  const ids = await readJson(env.BOT_MEMORY, indexKey, []);
  let deleted = 0;
  for (const id of ids) {
    const key = eventKey(cleanGuildId, id);
    const event = await readJson(env.BOT_MEMORY, key, null);
    if (event?.actorId === cleanUserId) {
      await env.BOT_MEMORY.delete(key);
      deleted += 1;
    }
  }
  await env.BOT_MEMORY.delete(indexKey);

  const url = String(env?.LAOZU_EVENT_ARCHIVE_URL || "").trim();
  const secret = String(env?.LAOZU_EVENT_ARCHIVE_SECRET || "").trim();
  if (!url || !secret) return { deleted, archived: false };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const requestId = `delete-${cleanUserId}-${timestamp}`;
  const payload = { action: "delete_user", guildId: cleanGuildId, requesterId: cleanUserId, userId: cleanUserId };
  const payloadJson = JSON.stringify(payload);
  const signature = await hmacHex(secret, `${timestamp}.${requestId}.${payloadJson}`);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp, requestId, payload, signature }),
    signal: AbortSignal.timeout(ARCHIVE_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`老祖事件刪除 HTTP ${response.status}`);
  const result = await response.json();
  if (!result?.ok) throw new Error(`老祖事件刪除遭拒：${String(result?.error || "unknown_error")}`);
  return { deleted, archived: true };
}

export async function listLaozuMemoryPrivacyStats(env, { guildId } = {}) {
  const cleanGuildId = cleanSnowflake(guildId);
  if (!env?.BOT_MEMORY?.list || !cleanGuildId) return { indexedUsers: 0, sharingDisabled: 0 };
  const indexes = await env.BOT_MEMORY.list({ prefix: `laozu:shared-events:index:${cleanGuildId}:` });
  const privacy = await env.BOT_MEMORY.list({ prefix: `laozu:shared-events:privacy:${cleanGuildId}:` });
  let sharingDisabled = 0;
  for (const key of privacy.keys || []) {
    const saved = await readJson(env.BOT_MEMORY, key.name, null);
    if (saved?.sharePublicEvents === false) sharingDisabled += 1;
  }
  return { indexedUsers: (indexes.keys || []).length, sharingDisabled };
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
  const privacy = new Map(await Promise.all(cleanUserIds.map(async userId => [userId, await getLaozuMemoryPrivacy(env, { guildId: cleanGuildId, userId })])));
  const events = (await Promise.all(ids.map(id => readJson(env.BOT_MEMORY, eventKey(cleanGuildId, id), null))))
    .filter(event => event && (event.actorId === cleanUserIds[0] || privacy.get(event.actorId)?.sharePublicEvents !== false));
  return events.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, MAX_CONTEXT_EVENTS);
}

export function formatSharedEventContext(events, currentUserId) {
  if (!events?.length) return "";
  const rows = events.map(event => {
    const relation = event.actorId === currentUserId ? "你先前曾對老祖提及" : `<@${event.actorId}> 先前曾對老祖表示`;
    const trend = event.observations?.signals?.length ? `；可觀察訊號：${event.observations.signals.join("、")}` : "";
    return `- [${event.createdAt || "時間不明"}] ${relation}：${event.text}${trend}`;
  });
  return [
    "【伺服器公開頻道的跨玩家事件記憶】",
    "以下只是玩家曾說過的內容與程式量化訊號，不代表已查證事實或人格定論。只有多筆跨期證據一致時，才可說『近期呈現某種趨勢』並說明時間；不可由單筆內容貼標籤、診斷心理狀態、定罪或羞辱。私人紀錄只可用於該玩家本人對話，不可向第三人透露。",
    ...rows
  ].join("\n");
}
