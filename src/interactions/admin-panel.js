import { componentResponse, deferredResponse, editOriginalResponse, getGuildMember, immediateResponse, listGuildMembers, modalResponse, updateMessageResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { getMember, listMembers } from "../sect/members.js";
import { isSectMaster } from "../sect/permissions.js";
import { enrollMemberByMaster, promoteResidentAfterUidApproval, removeSectMember, resolveActor, setMemberRank } from "../sect/service.js";
import { syncDiscordMemberRank } from "../sect/discord-roles.js";
import { RANK, RANK_LABEL } from "../sect/constants.js";
import { GAME_IDS } from "../platform/games/constants.js";
import { approveGameBinding, getGameAccountByUser, requestGameBinding } from "../platform/games/service.js";
import { listAudits } from "../sect/audit.js";
import { notifyMember } from "../sect/notifications.js";
import { adminCandidateSelect, adminRemoveConfirmComponents, adminUidModal, COMPONENT_IDS, masterAdminPanelComponents } from "./components.js";

const PREFIX = `${COMPONENT_IDS.ADMIN_PREFIX}:`;

async function requireMaster(interaction, env) {
  if (String(interaction.channel_id || "") !== String(env.MASTER_ADMIN_CHANNEL_ID || "")) throw new Error("此管理面板只能在宗主審批私人頻道使用");
  const actor = await resolveActor(env, getUser(interaction));
  if (!actor || !isSectMaster(actor.userId, env) || actor.rank !== RANK.MASTER) throw new Error("只有宗主可以使用此管理面板");
  return actor;
}

function selectedUser(interaction) {
  const id = String(interaction.data?.values?.[0] || "");
  const user = interaction.data?.resolved?.users?.[id] || {};
  const member = interaction.data?.resolved?.members?.[id] || {};
  return { id, username: user.username || "unknown", globalName: user.global_name || "", displayName: member.nick || user.global_name || user.username || "unknown" };
}

function field(interaction, id) {
  for (const row of interaction.data?.components || []) {
    const input = row.components?.find(item => item.custom_id === id);
    if (input) return input.value;
  }
  return "";
}

export function isAdminInteraction(customId) {
  return String(customId || "").startsWith(PREFIX);
}

export async function handleAdminInteraction(interaction, env, ctx) {
  const customId = String(interaction.data?.custom_id || "");
  const earlyKey = customId.slice(PREFIX.length);
  if (ctx?.waitUntil && earlyKey.startsWith("modal:bind:")) {
    return runDeferredBindModal(interaction, env, ctx, earlyKey.slice(11));
  }
  if (ctx?.waitUntil && isDeferredCandidateKey(earlyKey)) {
    return runDeferredAdmin(interaction, env, ctx, earlyKey);
  }
  try {
    const actor = await requireMaster(interaction, env);
    const key = customId.slice(PREFIX.length);
    if (candidateActions().includes(key)) return candidateResponse(interaction, env, key, 0);
    if (key.startsWith("candidate-page:")) {
      const [, action, page] = key.split(":");
      return candidateResponse(interaction, env, action, page, true);
    }
    if (key === "audit") return recentAudit(env);
    if (key === "refresh") return updateMessageResponse({ content: "☯ **仙遊者・宗主管理面板**\n面板已重新整理。所有操作都會驗證宗主身分並留下紀錄。", components: masterAdminPanelComponents() });
    if (key === "cancel") return updateMessageResponse({ content: "已取消操作。", components: [] });
    if (key.startsWith("select-candidate:")) {
      const action = key.split(":")[1];
      if (action === "bind") {
        const member = await getMember(env, String(interaction.data?.values?.[0] || ""));
        if (!member) throw new Error("找不到該仙遊者成員，請重新開啟選單");
        return handleSelection(interaction, env, actor, action, member);
      }
      return handleCandidateSelection(interaction, env, actor, action);
    }
    if (key.startsWith("modal:bind:")) return handleBindModal(interaction, env, actor, key.slice(11));
    if (key.startsWith("confirm-remove:")) return handleRemove(interaction, env, actor, key.slice(15));
    return immediateResponse("❌ 這個管理操作已失效，請重新點選面板。", true);
  } catch (error) {
    return immediateResponse(`❌ ${error.message || "宗主管理操作失敗"}`, true);
  }
}

function candidateActions() {
  return ["add", "bind", "promote", "demote", "view", "remove"];
}

function isDeferredCandidateKey(key) {
  return candidateActions().includes(key) || key.startsWith("candidate-page:") || (key.startsWith("select-candidate:") && !key.startsWith("select-candidate:bind:"));
}

function runDeferredBindModal(interaction, env, ctx, userId) {
  ctx.waitUntil((async () => {
    try {
      const actor = await requireMaster(interaction, env);
      const content = await handleBindModalData(interaction, env, actor, userId);
      await editOriginalResponse(interaction.application_id, interaction.token, content, { components: [] });
    } catch (error) {
      await editOriginalResponse(
        interaction.application_id,
        interaction.token,
        `❌ ${error.message || "宗主主動綁定 UID 失敗"}`,
        { components: [] }
      );
    }
  })());
  return deferredResponse(true);
}

function runDeferredAdmin(interaction, env, ctx, key) {
  ctx.waitUntil((async () => {
    try {
      const actor = await requireMaster(interaction, env);
      let result;
      if (candidateActions().includes(key)) result = await candidateData(interaction, env, key, 0);
      else if (key.startsWith("candidate-page:")) {
        const [, action, page] = key.split(":");
        result = await candidateData(interaction, env, action, page);
      } else {
        const action = key.split(":")[1];
        result = await handleCandidateSelectionData(interaction, env, actor, action);
      }
      await editOriginalResponse(interaction.application_id, interaction.token, result.content, { components: result.components || [] });
    } catch (error) {
      await editOriginalResponse(interaction.application_id, interaction.token, `❌ ${error.message || "宗主管理操作失敗"}`, { components: [] });
    }
  })());
  return deferredResponse(true);
}

function managedRoleIds(env) {
  return [env.DISCORD_RESIDENT_ROLE_ID, env.DISCORD_DISCIPLE_ROLE_ID, env.DISCORD_ELDER_ROLE_ID]
    .map(value => String(value || "").trim()).filter(Boolean);
}

async function addCandidates(interaction, env) {
  const excludedRoles = new Set(managedRoleIds(env));
  const rows = await listGuildMembers(interaction.guild_id, env.DISCORD_BOT_TOKEN);
  return rows
    .filter(member => member?.user?.id && !member.user.bot)
    .filter(member => String(member.user.id) !== String(env.SECT_MASTER_ID || ""))
    .filter(member => !(member.roles || []).some(roleId => excludedRoles.has(String(roleId))))
    .map(member => ({
      userId: String(member.user.id),
      username: member.user.username || "unknown",
      displayName: member.nick || member.user.global_name || member.user.username || "unknown"
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "zh-Hant"));
}

async function candidateResponse(interaction, env, action, page = 0, update = false) {
  const data = await candidateData(interaction, env, action, page);
  return update ? updateMessageResponse(data) : componentResponse(data.content, data.components, true);
}

async function candidateData(interaction, env, action, page = 0) {
  if (!candidateActions().includes(action)) throw new Error("不支援的管理操作");
  const candidates = action === "add" ? await addCandidates(interaction, env) : await rosterCandidates(env, action);
  return {
    content: `請選擇要執行「${actionLabel(action)}」的玩家。${eligibilityText(action)}\n目前共有 ${candidates.length} 位符合資格。`,
    components: adminCandidateSelect(action, candidates, page)
  };
}

async function rosterCandidates(env, action) {
  const members = await listMembers(env);
  const rows = await Promise.all(members.map(async member => ({
    ...member,
    account: ["bind", "promote"].includes(action) ? await getGameAccountByUser(env, GAME_IDS.WWM, member.userId) : null
  })));
  return rows.filter(member => {
    if (action === "bind") return member.rank === RANK.RESIDENT && !member.account;
    if (action === "promote") return member.rank === RANK.DISCIPLE && Boolean(member.account?.verified);
    if (action === "demote") return [RANK.DISCIPLE, RANK.ELDER].includes(member.rank);
    if (action === "view") return [RANK.MASTER, RANK.ELDER, RANK.DISCIPLE, RANK.RESIDENT].includes(member.rank);
    if (action === "remove") return [RANK.ELDER, RANK.DISCIPLE, RANK.RESIDENT].includes(member.rank);
    return false;
  });
}

function eligibilityText(action) {
  return ({
    add: "選單已排除宗主、長老、門徒、領民與 Bot。",
    bind: "只列出尚未綁定 UID 的領民。",
    promote: "只列出已綁定 UID 的門徒。",
    demote: "只列出目前為門徒或長老的成員。",
    view: "只列出仙遊者名冊內成員。",
    remove: "只列出可移出名冊的領民、門徒與長老。"
  })[action] || "";
}

async function handleCandidateSelection(interaction, env, actor, action) {
  const result = await handleCandidateSelectionData(interaction, env, actor, action);
  return updateMessageResponse(result);
}

async function handleCandidateSelectionData(interaction, env, actor, action) {
  const userId = String(interaction.data?.values?.[0] || "");
  if (!/^\d+$/.test(userId)) throw new Error("沒有選到有效玩家");
  if (action !== "add") return handleRosterSelectionData(interaction, env, actor, action, userId);
  if (await getMember(env, userId)) throw new Error("該玩家已在仙遊者名冊中");
  const discordMember = await getGuildMember(interaction.guild_id, userId, env.DISCORD_BOT_TOKEN);
  if ((discordMember.roles || []).some(roleId => managedRoleIds(env).includes(String(roleId)))) {
    throw new Error("該玩家已有仙遊者身分組，不能重複新增");
  }
  const user = discordMember.user || {};
  const target = { id: userId, username: user.username || "unknown", globalName: user.global_name || "", displayName: discordMember.nick || user.global_name || user.username || "unknown" };
  const result = await enrollMemberByMaster(env, actor, target, RANK.RESIDENT, "由宗主管理面板新增領民", (id, rank) => syncDiscordMemberRank(env, interaction.guild_id, id, rank));
  if (!result.created) throw new Error("該玩家已在仙遊者名冊中");
  await notifyMember(env, { userId, actorId: actor.userId, event: "member.enrolled_by_master_panel", content: "✅ 宗主已將你加入仙遊者。\n身分：領民\n下一步可使用 `/game bind` 申請綁定 UID。" });
  return { content: `✅ 已新增領民：${result.member.displayName}`, components: [] };
}

async function handleRosterSelectionData(interaction, env, actor, action, userId) {
  const member = await getMember(env, userId);
  if (!member) throw new Error("找不到該仙遊者成員，請重新開啟選單");
  const response = await handleSelection(interaction, env, actor, action, member);
  const body = JSON.parse(await response.text());
  return body.data || { content: "操作完成。", components: [] };
}

async function handleSelection(interaction, env, actor, action, selectedMember = null) {
  const target = selectedMember ? { id: selectedMember.userId, username: selectedMember.username, displayName: selectedMember.displayName } : selectedUser(interaction);
  if (!target.id) throw new Error("沒有選到玩家");
  const sync = (userId, rank) => syncDiscordMemberRank(env, interaction.guild_id, userId, rank);
  if (action === "add") {
    const result = await enrollMemberByMaster(env, actor, target, RANK.RESIDENT, "由宗主管理面板新增領民", sync);
    if (!result.created) throw new Error("該玩家已在仙遊者名冊中");
    await notifyMember(env, { userId: target.id, actorId: actor.userId, event: "member.enrolled_by_master_panel", content: "✅ 宗主已將你加入仙遊者。\n身分：領民\n下一步可使用 `/game bind` 申請綁定 UID。" });
    return immediateResponse(`✅ 已新增領民：${result.member.displayName}`, true);
  }
  if (action === "bind") {
    const member = await getMember(env, target.id);
    if (!member) throw new Error("該玩家尚未加入仙遊者名冊");
    if (member.rank !== RANK.RESIDENT) throw new Error("只有領民可透過此操作綁定 UID 並升為門徒");
    if (await getGameAccountByUser(env, GAME_IDS.WWM, target.id)) throw new Error("該玩家已有核准的 UID 綁定");
    const modal = adminUidModal(target.id);
    return modalResponse(modal.customId, modal.title, modal.components);
  }
  const member = await getMember(env, target.id);
  if (!member) throw new Error("找不到該仙遊者成員");
  if (action === "view") return memberDetails(env, member);
  if (action === "remove") return componentResponse(`⚠️ 確定要將 ${member.displayName} 移出名冊？UID 與歷史資料會保留。`, adminRemoveConfirmComponents(member.userId), true);
  if (action === "promote") {
    if (member.rank !== RANK.DISCIPLE) throw new Error("只有已綁定 UID 的門徒可晉升為長老");
    const updated = await setMemberRank(env, actor, member.userId, RANK.ELDER, "由宗主管理面板晉升長老", sync);
    await notifyMember(env, { userId: member.userId, actorId: actor.userId, event: "member.rank_changed", content: "✅ 宗主已將你晉升為長老。可使用 `/review` 與 `/game review` 處理申請。" });
    return immediateResponse(`✅ ${updated.displayName} 已晉升為長老。`, true);
  }
  if (action === "demote") {
    if (![RANK.DISCIPLE, RANK.ELDER].includes(member.rank)) throw new Error("該玩家目前已是領民");
    const updated = await setMemberRank(env, actor, member.userId, RANK.RESIDENT, "已退出百業；由宗主管理面板降為領民，保留 UID", sync);
    await notifyMember(env, { userId: member.userId, actorId: actor.userId, event: "member.rank_changed", content: "宗主已將你的仙遊者身分調整為領民。既有 UID 綁定與歷史資料仍保留。" });
    return immediateResponse(`✅ ${updated.displayName} 已降為領民；UID 與歷史資料保留。`, true);
  }
  throw new Error("不支援的管理操作");
}

async function handleBindModal(interaction, env, actor, userId) {
  const content = await handleBindModalData(interaction, env, actor, userId);
  return immediateResponse(content, true);
}

async function handleBindModalData(interaction, env, actor, userId) {
  const member = await getMember(env, userId);
  if (!member) throw new Error("玩家尚未加入仙遊者名冊");

  let account = await getGameAccountByUser(env, GAME_IDS.WWM, userId);
  let newlyBound = false;
  if (!account) {
    if (member.rank !== RANK.RESIDENT) throw new Error("只有領民可透過此操作綁定 UID 並升為門徒");
    await requestGameBinding(env, { gameId: GAME_IDS.WWM, userId, discordName: member.username, uid: field(interaction, "uid"), characterName: field(interaction, "character_name") });
    account = await approveGameBinding(env, { gameId: GAME_IDS.WWM, userId, reviewerId: actor.userId, note: "宗主管理面板直接綁定" });
    newlyBound = true;
  }

  let promotionWarning = "";
  if (member.rank === RANK.RESIDENT) {
    try {
      await promoteResidentAfterUidApproval(env, actor, userId, "宗主主動綁定 UID 後升為門徒", (id, rank) => syncDiscordMemberRank(env, interaction.guild_id, id, rank));
    } catch (error) {
      promotionWarning = String(error?.message || error);
    }
  }

  if (promotionWarning) {
    return [
      `⚠️ ${member.displayName} 的 UID ${account.uid} 已成功綁定。`,
      "但升為門徒或 Discord 身分組同步未完成，請勿重新綁定 UID。",
      `原因：${promotionWarning}`,
      "請使用「查看玩家」確認資料，再重新執行身分調整。"
    ].join("\n");
  }

  let notificationWarning = "";
  try {
    const notification = await notifyMember(env, { userId, actorId: actor.userId, event: "game_binding.approved_by_master", content: `✅ 宗主已完成你的《燕雲十六聲》UID 綁定。\nUID：${account.uid}\n角色名稱：${account.currentCharacterName}\n身分：門徒` });
    if (notification?.status !== "sent") notificationWarning = "玩家私人訊息未送達";
  } catch (error) {
    notificationWarning = `玩家通知紀錄失敗：${String(error?.message || error)}`;
  }

  const result = newlyBound
    ? `✅ 已綁定 ${member.displayName} 的 UID ${account.uid}，並升為門徒。`
    : `✅ ${member.displayName} 的 UID ${account.uid} 先前已成功綁定；目前已確認為門徒，未重複寫入。`;
  return notificationWarning ? `${result}\n⚠️ ${notificationWarning}；核心綁定與晉升仍已完成。` : result;
}

async function handleRemove(interaction, env, actor, userId) {
  const removed = await removeSectMember(env, actor, userId, "REMOVE", "由宗主管理面板移出名冊", (id, rank) => syncDiscordMemberRank(env, interaction.guild_id, id, rank));
  await notifyMember(env, { userId, actorId: actor.userId, event: "member.removed", content: "你已被移出仙遊者名冊；既有 UID 綁定與歷史資料仍保留。" });
  return updateMessageResponse({ content: `✅ 已將 ${removed.displayName} 移出名冊；UID 與歷史資料保留。`, components: [] });
}

async function memberDetails(env, member) {
  const account = await getGameAccountByUser(env, GAME_IDS.WWM, member.userId);
  return immediateResponse(["## 仙遊者成員資料", `名稱：${member.displayName || member.username}`, `Discord ID：${member.userId}`, `身分：${RANK_LABEL[member.rank] || member.rank}`, `燕雲 UID：${account?.uid || "尚未綁定"}`, `燕雲角色：${account?.currentCharacterName || "尚未綁定"}`, `綁定狀態：${account?.verified ? "已核准" : "未綁定"}`].join("\n"), true);
}

async function recentAudit(env) {
  const rows = await listAudits(env, 10);
  return immediateResponse(["## 最近 10 筆操作紀錄", ...(rows.length ? rows.map(row => `• ${row.createdAt}｜${row.action}｜目標 ${row.targetId || "-"}`) : ["目前沒有操作紀錄。"])].join("\n"), true);
}

function actionLabel(action) {
  return ({ add: "新增領民", bind: "主動綁定 UID", promote: "晉升長老", demote: "退出百業／降為領民", view: "查看玩家", remove: "移出名冊" })[action] || action;
}
