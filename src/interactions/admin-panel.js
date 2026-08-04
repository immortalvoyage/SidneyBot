import { componentResponse, deferredResponse, editOriginalResponse, getGuildMember, immediateResponse, listGuildMembers, modalResponse, updateMessageResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { getMember } from "../sect/members.js";
import { isSectMaster } from "../sect/permissions.js";
import { enrollMemberByMaster, promoteResidentAfterUidApproval, removeSectMember, resolveActor, setMemberRank } from "../sect/service.js";
import { syncDiscordMemberRank } from "../sect/discord-roles.js";
import { RANK, RANK_LABEL } from "../sect/constants.js";
import { GAME_IDS } from "../platform/games/constants.js";
import { approveGameBinding, getGameAccountByUser, requestGameBinding } from "../platform/games/service.js";
import { listAudits } from "../sect/audit.js";
import { notifyMember } from "../sect/notifications.js";
import { adminCandidateSelect, adminRemoveConfirmComponents, adminUidModal, adminUserSelect, COMPONENT_IDS, masterAdminPanelComponents } from "./components.js";

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
  if (ctx?.waitUntil && (earlyKey === "add" || earlyKey.startsWith("add-page:") || earlyKey.startsWith("select-add:"))) {
    return runDeferredAdmin(interaction, env, ctx, earlyKey);
  }
  try {
    const actor = await requireMaster(interaction, env);
    const key = customId.slice(PREFIX.length);
    if (key === "add") return addCandidateResponse(interaction, env, 0);
    if (key.startsWith("add-page:")) return addCandidateResponse(interaction, env, key.slice(9), true);
    if (["bind", "promote", "demote", "view", "remove"].includes(key)) return componentResponse(`請選擇要執行「${actionLabel(key)}」的玩家。`, adminUserSelect(key), true);
    if (key === "audit") return recentAudit(env);
    if (key === "refresh") return updateMessageResponse({ content: "☯ **仙遊者・宗主管理面板**\n面板已重新整理。所有操作都會驗證宗主身分並留下紀錄。", components: masterAdminPanelComponents() });
    if (key === "cancel") return updateMessageResponse({ content: "已取消操作。", components: [] });
    if (key.startsWith("select:")) return handleSelection(interaction, env, actor, key.slice(7));
    if (key.startsWith("select-add:")) return handleAddSelection(interaction, env, actor);
    if (key.startsWith("modal:bind:")) return handleBindModal(interaction, env, actor, key.slice(11));
    if (key.startsWith("confirm-remove:")) return handleRemove(interaction, env, actor, key.slice(15));
    return immediateResponse("❌ 這個管理操作已失效，請重新點選面板。", true);
  } catch (error) {
    return immediateResponse(`❌ ${error.message || "宗主管理操作失敗"}`, true);
  }
}

function runDeferredAdmin(interaction, env, ctx, key) {
  ctx.waitUntil((async () => {
    try {
      const actor = await requireMaster(interaction, env);
      let result;
      if (key === "add") result = await addCandidateData(interaction, env, 0);
      else if (key.startsWith("add-page:")) result = await addCandidateData(interaction, env, key.slice(9));
      else result = await handleAddSelectionData(interaction, env, actor);
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

async function addCandidateResponse(interaction, env, page = 0, update = false) {
  const data = await addCandidateData(interaction, env, page);
  return update ? updateMessageResponse(data) : componentResponse(data.content, data.components, true);
}

async function addCandidateData(interaction, env, page = 0) {
  const candidates = await addCandidates(interaction, env);
  return {
    content: `請選擇要新增的領民。選單已排除宗主、長老、門徒與領民。\n目前共有 ${candidates.length} 位可新增成員。`,
    components: adminCandidateSelect(candidates, page)
  };
}

async function handleAddSelection(interaction, env, actor) {
  const result = await handleAddSelectionData(interaction, env, actor);
  return updateMessageResponse(result);
}

async function handleAddSelectionData(interaction, env, actor) {
  const userId = String(interaction.data?.values?.[0] || "");
  if (!/^\d+$/.test(userId)) throw new Error("沒有選到有效玩家");
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

async function handleSelection(interaction, env, actor, action) {
  const target = selectedUser(interaction);
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
  const member = await getMember(env, userId);
  if (!member || member.rank !== RANK.RESIDENT) throw new Error("玩家目前不是可綁定的領民");
  if (await getGameAccountByUser(env, GAME_IDS.WWM, userId)) throw new Error("該玩家已有核准的 UID 綁定");
  await requestGameBinding(env, { gameId: GAME_IDS.WWM, userId, discordName: member.username, uid: field(interaction, "uid"), characterName: field(interaction, "character_name") });
  const account = await approveGameBinding(env, { gameId: GAME_IDS.WWM, userId, reviewerId: actor.userId, note: "宗主管理面板直接綁定" });
  await promoteResidentAfterUidApproval(env, actor, userId, "宗主主動綁定 UID 後升為門徒", (id, rank) => syncDiscordMemberRank(env, interaction.guild_id, id, rank));
  await notifyMember(env, { userId, actorId: actor.userId, event: "game_binding.approved_by_master", content: `✅ 宗主已完成你的《燕雲十六聲》UID 綁定。\nUID：${account.uid}\n角色名稱：${account.currentCharacterName}\n身分：門徒` });
  return immediateResponse(`✅ 已綁定 ${member.displayName} 的 UID ${account.uid}，並升為門徒。`, true);
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
