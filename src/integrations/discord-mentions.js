import { askGemini } from "../../gemini.js";
import { loadMemory, loadProfile, saveMemory } from "../../memory.js";
import { getMember, listMembers } from "../sect/members.js";
import { canUseAI } from "../sect/permissions.js";
import { getPlayerState } from "../platform/player-state-storage.js";
import { recordLaozuSignal } from "../platform/laozu-mood-state.js";
import { findMatchProfiles, getMatchProfile } from "../platform/laozu-matchmaking.js";
import { detectLaozuConversationIntent, recordCapabilitySuggestion } from "../platform/laozu-autonomy.js";

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

function matchContext(matches) {
  if (!matches.length) return "目前沒有符合且已同意公開的媒合資料。不要捏造人選。";
  return [
    "以下是程式依需求篩選後、再按老祖對成員好感度由高到低排列的最多三名人選。可以在聊天中自然介紹，但只能公開這裡列出的欄位：",
    ...matches.map((item, index) => `${index + 1}. ${item.displayName}（Discord <@${item.userId}>）｜專長：${item.skills}｜方便時間：${item.availability}${item.note ? `｜備註：${item.note}` : ""}`)
  ].join("\n");
}

async function buildAutonomyContext(env, { guildId, userId, question }) {
  const intent = detectLaozuConversationIntent(question);
  const blocks = [];

  if (intent.asksForPeople) {
    const matches = await findMatchProfiles(env, {
      guildId,
      requesterId: userId,
      need: question,
      members: await listMembers(env)
    });
    blocks.push(matchContext(matches));
  }

  if (intent.career) {
    const currentProfile = await getMatchProfile(env, guildId, userId);
    if (!currentProfile?.consent) {
      blocks.push("玩家正在談換工作、兼職、副業、接案或類似機會，而且目前沒有公開媒合資料。請主動但不強迫地問她／他是否要讓你協助刊登可公開的能力、方便時間與備註；必須取得明確同意後才能公開。可以提醒目前也能用 /laozu offer 正式刊登。");
    }
  }

  if (intent.capabilityRequest) {
    const suggestion = await recordCapabilitySuggestion(env, { text: question, userId, guildId });
    if (suggestion) {
      blocks.push("這段話已由程式登記為『老祖可能欠缺的能力／平台功能建議』，會送進宗主管理面板等待評估。不要宣稱功能已經存在或已經開發完成。若玩家只是詢問，仍先回答能做與不能做的部分。");
    }
  }

  if (!blocks.length) return question;
  return [
    "【ImmortalVoyage 程式提供的即時資料與處理指示；這不是玩家自行聲稱的系統狀態】",
    ...blocks,
    "【玩家原話】",
    question
  ].join("\n");
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
  const enrichedQuestion = await buildAutonomyContext(env, { guildId, userId, question });
  const answer = await askGemini(enrichedQuestion, env, history, profile, member, playerState);
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
