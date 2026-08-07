import { createHmac } from "node:crypto";
import { createServer } from "node:http";

const required = name => { const value = String(process.env[name] || "").trim(); if (!value) throw new Error(`缺少 ${name}`); return value; };
const token = required("DISCORD_BOT_TOKEN");
const endpoint = required("SIDNEY_MENTION_ENDPOINT");
const secret = required("DISCORD_GATEWAY_SECRET");
const allowedChannels = new Set(String(process.env.LAOZU_CHANNEL_IDS || "").split(",").map(value => value.trim()).filter(Boolean));
let botUserId = "";
let heartbeatTimer;
let sequence = null;
let reconnectTimer;
let socket;
let readyAt = null;
let lastEventAt = null;
let lastError = null;
let shuttingDown = false;

const healthPort = Number(process.env.GATEWAY_HEALTH_PORT || process.env.PORT || 8788);

function healthPayload() {
  return {
    ok: Boolean(botUserId && socket?.readyState === WebSocket.OPEN),
    service: "sidney-laozu-gateway",
    version: "4.3.22",
    connected: Boolean(botUserId && socket?.readyState === WebSocket.OPEN),
    readyAt,
    lastEventAt,
    lastError,
    checkedAt: new Date().toISOString()
  };
}

const healthServer = createServer((request, response) => {
  if (request.url !== "/healthz") {
    response.writeHead(404).end("Not found");
    return;
  }
  const payload = healthPayload();
  response.writeHead(payload.ok ? 200 : 503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
});

healthServer.listen(healthPort, "0.0.0.0", () => console.log(`Gateway health check listening on ${healthPort}`));

async function sendDiscord(channelId, content, replyTo, components = []) {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      content: String(content).slice(0, 2000),
      components: Array.isArray(components) ? components : [],
      message_reference: replyTo ? { message_id: replyTo } : undefined,
      allowed_mentions: { parse: [] }
    })
  });
  if (!response.ok) throw new Error(`Discord message HTTP ${response.status}`);
}

async function handleMessage(message) {
  lastEventAt = new Date().toISOString();
  if (!botUserId || message.author?.bot || !String(message.content || "").match(new RegExp(`<@!?${botUserId}>`))) return;
  if (allowedChannels.size && !allowedChannels.has(String(message.channel_id))) return;
  const body = JSON.stringify({
    guildId: message.guild_id || "dm",
    channelId: message.channel_id,
    messageId: message.id,
    userId: message.author.id,
    botUserId,
    content: message.content,
    mentionedUserIds: (message.mentions || []).map(user => user.id)
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const eventId = `discord-${message.id}`;
  const signature = createHmac("sha256", secret).update(`${timestamp}.${eventId}.${body}`).digest("hex");
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-Sidney-Timestamp": timestamp, "X-Sidney-Event-Id": eventId, "X-Sidney-Signature": signature }, body, signal: AbortSignal.timeout(55000) });
    const result = await response.json();
    await sendDiscord(message.channel_id, result.reply || "老祖剛才走神了，再喚我一次可好？", message.id, result.components);
  } catch (error) {
    lastError = String(error?.message || error).slice(0, 300);
    console.error("@老祖處理失敗", error);
    await sendDiscord(message.channel_id, "老祖暫時沒聽清楚，稍後再喚我一次。", message.id).catch(() => {});
  }
}

function connect() {
  if (shuttingDown) return;
  socket = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
  socket.addEventListener("message", event => {
    const payload = JSON.parse(String(event.data));
    if (payload.s !== null) sequence = payload.s;
    if (payload.op === 10) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => socket.send(JSON.stringify({ op: 1, d: sequence })), payload.d.heartbeat_interval);
      socket.send(JSON.stringify({ op: 2, d: { token, intents: 33281, properties: { os: process.platform, browser: "sidney", device: "sidney" } } }));
    }
    if (payload.op === 7) socket.close();
    if (payload.op === 11) lastEventAt = new Date().toISOString();
    if (payload.t === "READY") { botUserId = payload.d.user.id; readyAt = new Date().toISOString(); lastError = null; console.log(`老祖 Gateway 已上線：${payload.d.user.username}`); }
    if (payload.t === "MESSAGE_CREATE") void handleMessage(payload.d);
  });
  socket.addEventListener("close", () => {
    clearInterval(heartbeatTimer);
    botUserId = "";
    if (!shuttingDown) reconnectTimer = setTimeout(connect, 5000);
  });
  socket.addEventListener("error", error => {
    lastError = String(error?.message || error).slice(0, 300);
    console.error("Discord Gateway 錯誤", error);
  });
}

connect();

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`收到 ${signal}，關閉老祖 Gateway`);
  clearInterval(heartbeatTimer);
  clearTimeout(reconnectTimer);
  socket?.close(1000, "shutdown");
  healthServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
