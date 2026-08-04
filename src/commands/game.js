import { immediateResponse } from "../../discord.js";
import { getDisplayName, getUser, getUserId } from "../../utils.js";
import { ensureMaster, getMember } from "../sect/members.js";
import { canApprove, canUseAI } from "../sect/permissions.js";
import { GAME_IDS } from "../platform/games/constants.js";
import {
  approveGameBinding,
  getGameAccountByUser,
  listPendingBindings,
  rejectGameBinding,
  requestGameBinding
} from "../platform/games/service.js";
import { notifyMember, notificationSummary } from "../sect/notifications.js";
import { setMemberRank } from "../sect/service.js";
import { syncDiscordMemberRank } from "../sect/discord-roles.js";

function subcommand(interaction) {
  return interaction?.data?.options?.[0] || null;
}

function subOption(interaction, name) {
  return subcommand(interaction)?.options?.find(item => item.name === name)?.value;
}

export async function handleGame(interaction, env) {
  const action = subcommand(interaction)?.name;
  const user = getUser(interaction);
  const userId = getUserId(interaction);
  await ensureMaster(env, user);
  const member = await getMember(env, userId);

  if (!member || !canUseAI(member.rank)) {
    return immediateResponse("❌ 你目前不是仙遊者正式成員。", true);
  }

  if (action === "bind") {
    const request = await requestGameBinding(env, {
      gameId: GAME_IDS.WWM,
      userId,
      discordName: getDisplayName(interaction),
      uid: subOption(interaction, "uid"),
      characterName: subOption(interaction, "character_name")
    });
    return immediateResponse([
      "✅ 已提交《燕雲十六聲》角色綁定申請。",
      `UID：${request.uid}`,
      `角色名稱：${request.characterName}`,
      "狀態：等待宗主／長老核准"
    ].join("\n"), true);
  }

  if (action === "status") {
    const account = await getGameAccountByUser(env, GAME_IDS.WWM, userId);
    if (!account) {
      return immediateResponse("尚未完成《燕雲十六聲》UID 綁定。", true);
    }
    return immediateResponse([
      "## 燕雲十六聲角色",
      `UID：${account.uid}`,
      `目前名稱：${account.currentCharacterName}`,
      `驗證狀態：${account.verified ? "已驗證" : "未驗證"}`,
      `最後同步：${account.lastSyncedAt || "尚未同步"}`
    ].join("\n"), true);
  }

  if (!canApprove(member.rank)) {
    return immediateResponse("❌ 此操作只限宗主／長老。", true);
  }

  if (action === "pending") {
    const rows = await listPendingBindings(env, GAME_IDS.WWM);
    const eligibleRows = (await Promise.all(rows.map(async item => ({
      item,
      member: await getMember(env, item.userId)
    }))))
      .filter(({ member: target }) => target && canUseAI(target.rank))
      .map(({ item }) => item);
    if (eligibleRows.length === 0) return immediateResponse("目前沒有待審 UID 綁定。", true);
    return immediateResponse([
      "## 待審 UID 綁定",
      ...eligibleRows.slice(0, 20).map(item =>
        `• <@${item.userId}>｜Discord ID: ${item.userId}｜UID: ${item.uid}｜角色: ${item.characterName}`
      )
    ].join("\n"), true);
  }

  if (action === "review") {
    const targetUserId = String(subOption(interaction, "applicant") || "");
    const decision = String(subOption(interaction, "decision") || "");
    const targetMember = await getMember(env, targetUserId);
    if (!targetMember || !canUseAI(targetMember.rank)) {
      return immediateResponse("❌ 該申請者目前不是仙遊者正式成員，不能處理綁定。", true);
    }
    if (decision === "approve") {
      const account = await approveGameBinding(env, {
        gameId: GAME_IDS.WWM,
        userId: targetUserId,
        reviewerId: userId,
        note: subOption(interaction, "note") || ""
      });
      let promoted = false;
      if (targetMember.rank === "resident") {
        await setMemberRank(
          env,
          member,
          targetUserId,
          "disciple",
          "UID 綁定核准後自動升為門徒",
          (memberId, rank) => syncDiscordMemberRank(env, interaction.guild_id, memberId, rank)
        );
        promoted = true;
      }
      const notification = await notifyMember(env, {
        userId: targetUserId,
        actorId: userId,
        event: "game_binding.approved",
        content: [
          "✅ 你的《燕雲十六聲》UID 綁定已核准。",
          `UID：${account.uid}`,
          `角色名稱：${account.currentCharacterName}`,
          promoted ? "身分：已由領民自動升為門徒" : "身分：維持原身分"
        ].join("\n")
      });
      return immediateResponse(
        `✅ 已核准 UID ${account.uid} 綁定至 Discord ID ${account.userId}。${promoted ? "\n身分已自動調整為門徒。" : ""}\n${notificationSummary(notification)}`,
        true
      );
    }
    if (decision === "reject") {
      const record = await rejectGameBinding(env, {
        gameId: GAME_IDS.WWM,
        userId: targetUserId,
        reviewerId: userId,
        note: subOption(interaction, "note") || ""
      });
      const note = subOption(interaction, "note") || "未提供";
      const notification = await notifyMember(env, {
        userId: targetUserId,
        actorId: userId,
        event: "game_binding.rejected",
        content: [
          "❌ 你的《燕雲十六聲》UID 綁定申請未獲核准。",
          `UID：${record.uid}`,
          `審核備註：${note}`,
          "請確認 UID 與角色名稱後重新提交，或聯絡宗主。"
        ].join("\n")
      });
      return immediateResponse(
        `✅ 已拒絕 ${record.discordName || record.userId} 的 UID 綁定申請。\n${notificationSummary(notification)}`,
        true
      );
    }
    return immediateResponse("❌ 請選擇核准或拒絕。", true);
  }

  return immediateResponse("❌ 不支援的 /game 子指令。", true);
}
