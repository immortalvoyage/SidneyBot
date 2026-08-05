import { createHmac } from "node:crypto";

const required = name => { const value = String(process.env[name] || "").trim(); if (!value) throw new Error(`缺少 ${name}`); return value; };
const token = required("DISCORD_BOT_TOKEN");
const endpoint = required("SIDNEY_MENTION_ENDPOINT");
const secret = required("DISCORD_GATEWAY_SECRET");
const allowedChannels = new Set(String(process.env.LAOZU_CHANNEL_IDS || "").split(",").map(value => value.trim()).filter(Boolean));
let botUserId = "";
let heartbeatTimer;
let sequence = null;

async function sendDiscord(channelId, content, replyTo) {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content: String(content).slice(0, 2000), message_reference: replyTo ? { message_id: replyTo } : undefined, allowed_mentions: { parse: [] } })
  });
  if (!response.ok) throw new Error(`Discord message HTTP ${response.status}`);
}

async function handleMessage(message) {
  if (!botUserId || message.author?.bot || !String(message.content || "").match(new RegExp(`<@!?${botUserId}>`))) return;
  if (allowedChannels.size && !allowedChannels.has(String(message.channel_id))) return;
  const body = JSON.stringify({ guildId: message.guild_id || "dm", channelId: message.channel_id, messageId: message.id, userId: message.author.id, botUserId, content: message.content });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const eventId = `discord-${message.id}`;
  const signature = createHmac("sha256", secret).update(`${timestamp}.${eventId}.${body}`).digest("hex");
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "X-Sidney-Timestamp": timestamp, "X-Sidney-Event-Id": eventId, "X-Sidney-Signature": signature }, body, signal: AbortSignal.timeout(55000) });
    const result = await response.json();
    await sendDiscord(message.channel_id, result.reply || "老祖剛才走神了，再喚我一次可好？", message.id);
  } catch (error) {
    console.error("@老祖處理失敗", error);
    await sendDiscord(message.channel_id, "老祖暫時沒聽清楚，稍後再喚我一次。", message.id).catch(() => {});
  }
}

function connect() {
  const socket = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");
  socket.addEventListener("message", event => {
    const payload = JSON.parse(String(event.data));
    if (payload.s !== null) sequence = payload.s;
    if (payload.op === 10) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => socket.send(JSON.stringify({ op: 1, d: sequence })), payload.d.heartbeat_interval);
      socket.send(JSON.stringify({ op: 2, d: { token, intents: 33281, properties: { os: process.platform, browser: "sidney", device: "sidney" } } }));
    }
    if (payload.op === 7) socket.close();
    if (payload.t === "READY") { botUserId = payload.d.user.id; console.log(`老祖 Gateway 已上線：${payload.d.user.username}`); }
    if (payload.t === "MESSAGE_CREATE") void handleMessage(payload.d);
  });
  socket.addEventListener("close", () => { clearInterval(heartbeatTimer); setTimeout(connect, 5000); });
  socket.addEventListener("error", error => console.error("Discord Gateway 錯誤", error));
}

connect();
