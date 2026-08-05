import { kvGet, kvPut } from "../sect/storage.js";
import { writeAudit } from "../sect/audit.js";
import { recordLaozuSignal } from "../platform/laozu-mood-state.js";

const MAX_AGE_SECONDS = 300;
const MAX_CODES = 40;

export async function handleRedeemCodeEvent(request, env) {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const secret = String(env.REDEEM_TRACKER_SECRET || "");
  if (!secret) return json({ error: "integration_not_configured" }, 503);

  const body = await request.text();
  const timestamp = request.headers.get("X-Sidney-Timestamp") || "";
  const eventId = cleanId(request.headers.get("X-Sidney-Event-Id"));
  const signature = request.headers.get("X-Sidney-Signature") || "";

  if (!eventId || !validTimestamp(timestamp)) {
    return json({ error: "invalid_or_expired_request" }, 401);
  }

  const expected = await hmacHex(secret, `${timestamp}.${eventId}.${body}`);
  if (!constantTimeEqual(expected, signature.toLowerCase())) {
    return json({ error: "invalid_signature" }, 401);
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  if (payload && payload.type === "connection_test") {
    await publishConnectionTestAsLaozu(env);
    return json({ ok: true, connectionTest: true });
  }

  const codes = normalizeCodes(payload.codes);
  if (!codes.length) return json({ error: "codes_required" }, 400);

  const dedupeKey = `integration:redeem-code:event:${eventId}`;
  if (await kvGet(env, dedupeKey, null)) {
    return json({ ok: true, duplicate: true });
  }

  await publishAsLaozu(env, codes, payload);
  await kvPut(env, dedupeKey, { receivedAt: new Date().toISOString(), codes }, {
    expirationTtl: 60 * 60 * 24 * 90
  });
  await writeAudit(env, {
    action: "redeem_codes_announced",
    actorId: "system:redeem-tracker",
    details: { eventId, codes, count: codes.length }
  });
  await recordLaozuSignal(env, {
    type: "redeem_codes_found",
    actorId: "system:redeem-tracker",
    eventId: `redeem:${eventId}`,
    weight: Math.min(3, codes.length)
  });

  return json({ ok: true, announced: codes.length });
}

async function publishConnectionTestAsLaozu(env) {
  const token = String(env.DISCORD_BOT_TOKEN || "");
  const channelId = String(env.REDEEM_CODE_CHANNEL_ID || "");
  if (!token || !/^\d+$/.test(channelId)) throw new Error("兌換碼公告頻道或 Bot Token 尚未設定");

  const content = [
    "## ☯ 老祖連線測試成功",
    "Sidney Worker 已通過簽章驗證，並成功以老祖身分連接兌換碼公告頻道。",
    "這是系統測試訊息，不是新兌換碼公告。"
  ].join("\n");

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
  });
  if (!response.ok) throw new Error(`Discord 測試訊息發送失敗：HTTP ${response.status}`);
}

function normalizeCodes(values) {
  const result = [];
  for (const value of Array.isArray(values) ? values : []) {
    const code = String(value || "").trim().toUpperCase();
    if (/^[A-Z0-9_-]{2,64}$/.test(code) && !result.includes(code)) result.push(code);
    if (result.length >= MAX_CODES) break;
  }
  return result;
}

async function publishAsLaozu(env, codes, payload) {
  const token = String(env.DISCORD_BOT_TOKEN || "");
  const channelId = String(env.REDEEM_CODE_CHANNEL_ID || "");
  if (!token || !/^\d+$/.test(channelId)) throw new Error("兌換碼公告頻道或 Bot Token 尚未設定");

  const lines = codes.map(code => `\`${code}\``).join("\n");
  const content = [
    "## 🆕 老祖發現新的《燕雲十六聲》兌換碼",
    lines,
    "",
    `本次新增：${codes.length}｜目前可用：${Number(payload.activeCount) || 0}`,
    "孩子們記得儘早兌換，過期了老祖也救不回來喔。"
  ].join("\n");

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } })
  });
  if (!response.ok) throw new Error(`Discord 公告失敗：HTTP ${response.status}`);
}

function validTimestamp(value) {
  if (!/^\d{10}$/.test(value)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - Number(value)) <= MAX_AGE_SECONDS;
}

function cleanId(value) {
  const id = String(value || "").trim();
  return /^[A-Za-z0-9_-]{8,128}$/.test(id) ? id : "";
}

async function hmacHex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=UTF-8" } });
}
