const DATA_CENTER_TIMEOUT_MS = 8000;

async function hmacHex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

export async function syncLaozuDataCenter(env, action, data = {}, fetchImpl = fetch) {
  const url = String(env?.LAOZU_EVENT_ARCHIVE_URL || "").trim();
  const secret = String(env?.LAOZU_EVENT_ARCHIVE_SECRET || "").trim();
  if (!url || !secret) return { skipped: true };
  const timestamp = String(Math.floor(Date.now() / 1000));
  const requestId = `${action}-${timestamp}-${crypto.randomUUID().slice(0, 8)}`;
  const payload = { action, ...data };
  const payloadJson = JSON.stringify(payload);
  const signature = await hmacHex(secret, `${timestamp}.${requestId}.${payloadJson}`);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timestamp, requestId, payload, signature }),
    signal: AbortSignal.timeout(DATA_CENTER_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`老祖資料中心 HTTP ${response.status}`);
  const result = await response.json();
  if (!result?.ok) throw new Error(`老祖資料中心遭拒：${String(result?.error || "unknown_error")}`);
  return result;
}
