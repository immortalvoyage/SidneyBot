import { askGemini } from "../../gemini.js";
import { loadMemory, loadProfile, saveMemory } from "../../memory.js";
import { getMember, listMembers } from "../sect/members.js";
import { canUseAI } from "../sect/permissions.js";
import { getPlayerState } from "../platform/player-state-storage.js";
import { recordLaozuSignal } from "../platform/laozu-mood-state.js";
import {
  confirmMatchProfileDraft,
  discardMatchProfileDraft,
  findMatchProfiles,
  getMatchProfile,
  getMatchProfileDraft,
  parseMatchProfileDraft,
  parseMatchProfilePatch,
  publishMatchProfile,
  saveMatchProfileDraft,
  updateMatchProfile,
  withdrawMatchProfile
} from "../platform/laozu-matchmaking.js";
import { detectLaozuConversationIntent, recordCapabilitySuggestion } from "../platform/laozu-autonomy.js";
import { laozuListingConfirmComponents } from "../interactions/components.js";
import {
  extractMentionedUserIds,
  formatSharedEventContext,
  loadSharedLaozuEvents,
  queryArchivedLaozuEvents,
  recordSharedLaozuEvent
} from "../platform/laozu-shared-events.js";

const MAX_AGE_SECONDS = 300;

const RANK_NAMES = {
  master: "宗主",
  elder: "長老",
  disciple: "門徒",
  resident: "領民",
  pending: "待審核者",
  outsider: "陌生人"
};

export function needsSectRosterContext(question, mentionedUserIds = []) {
  const text = String(question || "");
  return mentionedUserIds.length > 0
    || /(仙遊者|宗門|名冊|成員|玩家|宗主|長老|門徒|領民).{0,20}(誰|哪些|有沒有|是否|認識|知道|叫什麼|是誰|在不在)/u.test(text)
    || /(誰|哪些|有沒有|是否|認識|知道|叫什麼|是誰|在不在).{0,20}(仙遊者|宗門|名冊|成員|玩家|宗主|長老|門徒|領民)/u.test(text);
}

export function formatSectRosterContext(members = []) {
  const active = members.filter(item => item && item.active !== false);
  if (!active.length) {
    return "正式名冊目前沒有可用成員資料。這代表本次查詢查無資料，不代表任何人已離宗或外出。";
  }
  return [
    `正式名冊共 ${active.length} 人；以下資料來自系統即時查詢：`,
    ...active.slice(0, 200).map(item => {
      const id = String(item.userId || "").trim();
      const name = String(item.displayName || item.username || "未記名仙友").trim();
      return `- Discord ID ${id}｜名稱 ${name}｜身分 ${RANK_NAMES[item.rank] || item.rank || "未知"}`;
    }),
    active.length > 200 ? `另有 ${active.length - 200} 人未載入本次上下文；不得猜測其資料。` : "",
    "回答成員身分時，以 Discord ID 精確比對；不得把目前說話者的 ID 套到其他 mention。"
  ].filter(Boolean).join("\n");
}

export function directRosterReply(question, members = [], mentionedUserIds = []) {
  const text = String(question || "").trim();
  const active = members.filter(item => item && item.active !== false);
  const asksForRoster = /(仙遊者|宗門|名冊|成員|玩家).{0,16}(有哪些|有誰|哪些人|名單|列出)|(?:有哪些|有誰|哪些人|名單|列出).{0,16}(仙遊者|宗門|名冊|成員|玩家)/u.test(text);

  if (asksForRoster) {
    const groups = ["master", "elder", "disciple", "resident"]
      .map(rank => {
        const names = active
          .filter(item => item.rank === rank)
          .map(item => String(item.displayName || item.username || "未記名仙友").trim());
        return names.length ? `**${RANK_NAMES[rank]}（${names.length}）**\n${names.join("、")}` : "";
      })
      .filter(Boolean);
    return [
      `仙遊者目前共有 **${active.length} 位**正式成員：`,
      "",
      ...groups.flatMap((group, index) => index ? ["", group] : [group]),
      "",
      "若要查某一位，直接 @對方問本座即可。"
    ].join("\n");
  }

  if (mentionedUserIds.length === 1 && /(是誰|哪位|認識|知道|身分|身份)/u.test(text)) {
    const userId = String(mentionedUserIds[0]);
    const target = active.find(item => String(item.userId) === userId);
    if (!target) return "本座已查過目前的正式名冊，查無這位玩家；其身分現在無法確認。";
    const name = String(target.displayName || target.username || "未記名仙友").trim();
    return `這位是 **${name}**，目前身分為 **${RANK_NAMES[target.rank] || "正式成員"}**。`;
  }

  return null;
}

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
  if (!matches.length) return "目前沒有符合且已同意公開的媒合資料。不要捏造人選；直接告訴玩家目前查不到已刊登且相符的人。";
  return [
    "玩家正在找具有相關專長的人。你必須優先回答這個媒合結果，不要只閒聊帶過。以下是程式依需求篩選後、再按老祖對成員好感度由高到低排列的最多三名人選。只能公開這裡列出的欄位：",
    ...matches.map((item, index) => `${index + 1}. ${item.displayName}（Discord <@${item.userId}>）｜專長：${item.skills}｜方便時間：${item.availability}${item.note ? `｜備註：${item.note}` : ""}`),
    "請直接自然地介紹上述人選；若有一人以上，至少明確說出第一名。"
  ].join("\n");
}

function formatOwnProfile(profile) {
  if (!profile?.consent) return "你目前沒有已公開的專長刊登。";
  return [
    "## 📋 你的專長刊登",
    `專長：${profile.skills || (profile.skillList || []).join("、") || "-"}`,
    `方便時間：${profile.availability || "請私下協調"}`,
    profile.note ? `備註：${profile.note}` : "備註：無",
    `最後更新：${profile.updatedAt || "-"}`,
    "每位仙友只保留一筆公開刊登；重新刊登時，本座會先列出現有內容與新內容，確認後才取代。",
    "可直接對本座說「修改我的刊登 專長：A、B，方便時間：晚上」或「刪除我的刊登」。"
  ].join("\n");
}

function ownListingIntent(question) {
  const text = String(question || "").trim();
  const deleteListing = /(刪除|撤回|撤下|下架).{0,10}(我的)?(?:專長)?刊登/u.test(text);
  const editListing = /(修改|編輯|更新|更改|改一下|改).{0,10}(我的)?(?:專長)?刊登/u.test(text);
  const viewListing = /(查看|看看|顯示|查詢|看一下).{0,10}(我的)?(?:專長)?刊登/u.test(text)
    || /^我的(?:專長)?刊登(?:內容|資料)?[？?]?$/u.test(text);
  if (deleteListing) return "delete";
  if (editListing) return "edit";
  if (viewListing) return "view";
  return "";
}

function normalizedProfileData(profile) {
  return {
    skills: String(profile?.skills || (profile?.skillList || []).join("、") || "").trim(),
    availability: String(profile?.availability || "請私下協調").trim(),
    note: String(profile?.note || "").trim()
  };
}

function sameListing(current, draft) {
  const left = normalizedProfileData(current);
  const right = normalizedProfileData({
    skills: (draft?.skillList || []).join("、"),
    availability: draft?.availability,
    note: draft?.note
  });
  return left.skills === right.skills
    && left.availability === right.availability
    && left.note === right.note;
}

async function processOwnListingManagement(env, { guildId, member, question }) {
  const action = ownListingIntent(question);
  if (!action) return null;

  if (action === "view") {
    return formatOwnProfile(await getMatchProfile(env, guildId, member.userId));
  }

  if (action === "delete") {
    const current = await getMatchProfile(env, guildId, member.userId);
    if (!current?.consent) return "你目前沒有已公開的專長刊登，因此沒有資料需要刪除。";
    await withdrawMatchProfile(env, guildId, member.userId);
    await discardMatchProfileDraft(env, guildId, member.userId);
    return "✅ 已刪除你的專長刊登。資料已從公開媒合資料庫移除，之後不會再被介紹給其他仙友。";
  }

  const current = await getMatchProfile(env, guildId, member.userId);
  if (!current?.consent) {
    return "你目前沒有已公開的刊登可修改。可以先告訴本座「我擅長 A、B，方便時間：晚上」建立刊登草稿。";
  }
  const patch = parseMatchProfilePatch(question);
  if (!patch.skillList && patch.availability === null && patch.note === null) {
    return [
      "可以修改，但這句裡還沒有新的刊登內容。",
      "請像這樣告訴本座：",
      "`修改我的刊登 專長：程式設計、影片剪輯，方便時間：平日晚間，備註：可先私訊`"
    ].join("\n");
  }
  const updated = await updateMatchProfile(env, {
    guildId,
    member,
    skillList: patch.skillList,
    availability: patch.availability,
    note: patch.note
  });
  return [
    "✅ 已修改你的專長刊登，資料已實際更新。",
    `專長：${updated.skills}`,
    `方便時間：${updated.availability}`,
    updated.note ? `備註：${updated.note}` : "備註：無"
  ].join("\n");
}

export async function processMatchListingChat(env, { guildId, member, question }) {
  const draft = parseMatchProfileDraft(question);
  const explicitConsent = /(確認刊登|確認公開|同意刊登|同意公開|幫我刊登|可以公開|公開吧)/u.test(question);
  const simpleConfirm = /^(確認|確認更新|同意|可以|好|好的|ok|OK)$/u.test(question.trim());
  const explicitDraftConfirm = /^(確認更新|確認刊登|確認公開)$/u.test(question.trim());
  const cancel = /^(取消|不要刊登|取消刊登|不要公開|取消更新)$/u.test(question.trim());

  if (cancel && await getMatchProfileDraft(env, guildId, member.userId)) {
    await discardMatchProfileDraft(env, guildId, member.userId);
    return "✅ 已取消這次專長刊登草稿，現有公開刊登沒有變更。";
  }

  if ((simpleConfirm || explicitConsent) && !draft) {
    const before = await getMatchProfile(env, guildId, member.userId);
    const pending = await getMatchProfileDraft(env, guildId, member.userId);
    if (!pending && !explicitDraftConfirm && !explicitConsent) return null;
    const profile = await confirmMatchProfileDraft(env, { guildId, member });
    if (profile) {
      const replaced = Boolean(before?.consent && pending);
      return [
        replaced
          ? "✅ 已確認更新。舊刊登已由這筆新資料取代；每位仙友仍只保留一筆公開刊登。"
          : "✅ 已完成公開刊登，資料已實際寫入媒合資料庫。",
        `專長：${profile.skills}`,
        `方便時間：${profile.availability}`,
        profile.note ? `備註：${profile.note}` : null,
        "之後其他仙友詢問相符需求時，老祖可以依好感度優先介紹；可隨時查看、修改或刪除自己的刊登。"
      ].filter(Boolean).join("\n");
    }
    return "目前沒有等待確認的專長刊登草稿，所以本座沒有更新任何資料。請先告訴本座新的專長內容，再進行確認。";
  }

  if (!draft) return null;

  const current = await getMatchProfile(env, guildId, member.userId);
  if (current?.consent) {
    if (sameListing(current, draft)) {
      await discardMatchProfileDraft(env, guildId, member.userId);
      return [
        "你目前已經有一筆公開刊登，而且內容與這次提供的資料相同，因此不需要更新。",
        `專長：${current.skills}`,
        `方便時間：${current.availability}`,
        current.note ? `備註：${current.note}` : "備註：無"
      ].join("\n");
    }

    const saved = await saveMatchProfileDraft(env, { guildId, member, draft });
    return [
      "你目前已經有一筆公開刊登。本座不會新增第二筆；請先確認是否要用新內容**取代現有刊登**。",
      "",
      "**目前公開內容**",
      `專長：${current.skills || (current.skillList || []).join("、")}`,
      `方便時間：${current.availability || "請私下協調"}`,
      current.note ? `備註：${current.note}` : "備註：無",
      "",
      "**準備更新為**",
      `專長：${saved.skillList.join("、")}`,
      `方便時間：${saved.availability}`,
      saved.note ? `備註：${saved.note}` : "備註：無",
      "",
      "請使用下方按鈕確認是否取代現有刊登。文字「確認更新／取消更新」仍可作為備援。"
    ].join("\n");
  }

  if (explicitConsent) {
    const profile = await publishMatchProfile(env, {
      guildId,
      member,
      skillList: draft.skillList,
      availability: draft.availability,
      note: draft.note,
      consent: "AGREE"
    });
    return [
      "✅ 已完成公開刊登，資料已實際寫入媒合資料庫。",
      `專長：${profile.skills}`,
      `方便時間：${profile.availability}`,
      profile.note ? `備註：${profile.note}` : null
    ].filter(Boolean).join("\n");
  }

  const saved = await saveMatchProfileDraft(env, { guildId, member, draft });
  return [
    "本座已整理成刊登草稿，但**尚未公開**：",
    `專長：${saved.skillList.join("、")}`,
    `方便時間：${saved.availability}`,
    saved.note ? `備註：${saved.note}` : null,
    "一個人可以刊登多項專長，但只保留一筆公開刊登。",
    "若內容正確，直接回覆「確認」；本座會在實際寫入成功後明確回覆「已完成公開刊登」。"
  ].filter(Boolean).join("\n");
}

async function buildAutonomyContext(env, { guildId, userId, question, sharedEvents = [] }) {
  const intent = detectLaozuConversationIntent(question);
  const blocks = [];

  const sharedContext = formatSharedEventContext(sharedEvents, userId);
  if (sharedContext) blocks.push(sharedContext);

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
      blocks.push("玩家正在談換工作、兼職、副業、接案或類似機會，而且目前沒有公開媒合資料。請主動但不強迫地問她／他是否要讓你協助刊登可公開的多項能力、方便時間與備註；必須取得明確同意後才能公開。玩家也可以直接用自然語句告訴你『我擅長 A、B，接案時間晚上』建立草稿，再回覆『確認』完成刊登。");
    } else {
      blocks.push("玩家目前已經有一筆公開專長刊登。若玩家想再次刊登新的能力資料，不要直接說已刊登而結束；應提醒每人只保留一筆，並引導他提供新內容，由程式列出舊資料與新資料，確認後再取代。"
      );
    }
  }

  if (intent.capabilityRequest) {
    const suggestion = await recordCapabilitySuggestion(env, { text: question, userId, guildId });
    if (suggestion) {
      blocks.push("這段話已由程式登記為『老祖可能欠缺的能力／平台功能建議』，會送進宗主管理面板等待評估。相似需求會自動合併，不要宣稱功能已經存在或已經開發完成。若玩家只是詢問，仍先回答能做與不能做的部分。");
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

async function finishChat(env, { guildId, userId, question, answer, eventId }) {
  await saveMemory(env, guildId, userId, question, answer);
  await recordLaozuSignal(env, {
    type: "meaningful_chat",
    actorId: userId,
    eventId: `mention-chat:${userId}:${new Date().toISOString().slice(0, 10)}`
  });
  await env.BOT_MEMORY?.put(`integration:discord-mention:event:${eventId}`, JSON.stringify({ receivedAt: new Date().toISOString() }), { expirationTtl: 86400 });
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
  const channelId = cleanSnowflake(payload.channelId);
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

  const mentionedUserIds = extractMentionedUserIds(payload.content, botUserId).filter(id => id !== userId);
  const needsRoster = needsSectRosterContext(question, mentionedUserIds);
  const rosterMembers = needsRoster ? await listMembers(env) : [];
  const sectContext = needsRoster ? formatSectRosterContext(rosterMembers) : "";
  let sharedEvents = await loadSharedLaozuEvents(env, {
    guildId,
    userIds: [userId, ...mentionedUserIds],
    excludeEventId: eventId
  });

  if (!sharedEvents.length) {
    try {
      sharedEvents = await queryArchivedLaozuEvents(env, {
        guildId,
        requesterId: userId,
        userIds: [userId, ...mentionedUserIds]
      });
    } catch (error) {
      console.error("老祖事件歷史查詢失敗", error);
    }
  }

  await recordSharedLaozuEvent(env, {
    guildId,
    channelId,
    actorId: userId,
    participantIds: mentionedUserIds,
    eventId,
    text: question,
    scope: guildId === "dm" ? "private" : "public"
  });

  const rosterReply = directRosterReply(question, rosterMembers, mentionedUserIds);
  if (rosterReply) {
    await finishChat(env, { guildId, userId, question, answer: rosterReply, eventId });
    return json({ ok: true, reply: rosterReply });
  }

  const managementReply = await processOwnListingManagement(env, { guildId, member, question });
  if (managementReply) {
    await finishChat(env, { guildId, userId, question, answer: managementReply, eventId });
    return json({ ok: true, reply: managementReply });
  }

  const intent = detectLaozuConversationIntent(question);
  if (!intent.asksForPeople) {
    const directReply = await processMatchListingChat(env, { guildId, member, question });
    if (directReply) {
      await finishChat(env, { guildId, userId, question, answer: directReply, eventId });
      const pending = await getMatchProfileDraft(env, guildId, userId);
      return json({
        ok: true,
        reply: directReply,
        components: pending ? laozuListingConfirmComponents(userId) : []
      });
    }
  }

  const enrichedQuestion = await buildAutonomyContext(env, { guildId, userId, question, sharedEvents });
  const answer = await askGemini(enrichedQuestion, env, history, profile, member, playerState, { sectContext });
  await finishChat(env, { guildId, userId, question, answer, eventId });
  return json({ ok: true, reply: answer });
}

function cleanSnowflake(value) { const id = String(value || "").trim(); return /^\d{6,24}$/.test(id) ? id : ""; }
function cleanId(value) { const id = String(value || "").trim(); return /^[A-Za-z0-9_-]{8,128}$/.test(id) ? id : ""; }
function validTimestamp(value) { return /^\d{10}$/.test(value) && Math.abs(Math.floor(Date.now() / 1000) - Number(value)) <= MAX_AGE_SECONDS; }
async function hmacHex(secret, message) { const encoder = new TextEncoder(); const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message))); return [...bytes].map(value => value.toString(16).padStart(2, "0")).join(""); }
function constantTimeEqual(left, right) { if (!left || left.length !== right.length) return false; let diff = 0; for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i); return diff === 0; }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" } }); }
