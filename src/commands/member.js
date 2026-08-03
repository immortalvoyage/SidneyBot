import { immediateResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { RANK_LABEL } from "../sect/constants.js";
import { GAME_IDS } from "../platform/games/constants.js";
import { getGameAccountByUser } from "../platform/games/service.js";
import { getMember } from "../sect/members.js";
import { canManageRanks } from "../sect/permissions.js";
import {
  removeSectMember,
  resolveActor,
  setMemberRank
} from "../sect/service.js";
import { syncDiscordMemberRank } from "../sect/discord-roles.js";

function subcommand(interaction) {
  return interaction?.data?.options?.[0] || null;
}

function subOption(interaction, name) {
  return subcommand(interaction)?.options?.find(
    item => item.name === name
  )?.value;
}

export async function handleMember(interaction, env) {
  const action = subcommand(interaction)?.name;

  if (!["get", "set-rank", "remove"].includes(action)) {
    return immediateResponse(
      "❌ 不支援的 /member 子指令。",
      true
    );
  }

  try {
    const actor = await resolveActor(env, getUser(interaction));

    if (action === "get") {
      const targetId = String(subOption(interaction, "player") || "").trim();
      if (!targetId) throw new Error("請從仙遊者名冊選擇玩家");
      if (!actor || !canManageRanks(actor.rank)) {
        throw new Error("只有宗主可以查看成員詳細資料");
      }

      const [member, account] = await Promise.all([
        getMember(env, targetId),
        getGameAccountByUser(env, GAME_IDS.WWM, targetId)
      ]);
      if (!member) throw new Error("找不到該仙遊者成員");

      return immediateResponse(
        [
          "## 仙遊者成員資料",
          `名稱：${member.displayName || member.username}`,
          `Discord 帳號：${member.username || "未知"}`,
          `Discord ID：${member.userId}`,
          `身分：${RANK_LABEL[member.rank] || member.rank}`,
          `入宗時間：${member.joinedAt || "未知"}`,
          `燕雲 UID：${account?.uid || "尚未綁定"}`,
          `燕雲角色：${account?.currentCharacterName || "尚未綁定"}`,
          `綁定驗證：${account?.verified ? "已核准" : "無已核准綁定"}`
        ].join("\n"),
        true
      );
    }

    if (action === "remove") {
      const removed = await removeSectMember(
        env,
        actor,
        subOption(interaction, "player"),
        subOption(interaction, "confirm"),
        subOption(interaction, "note") || "",
        (userId, rank) => syncDiscordMemberRank(
          env,
          interaction.guild_id,
          userId,
          rank
        )
      );

      return immediateResponse(
        [
          "✅ 已將成員移出仙遊者名冊。",
          `成員：${removed.displayName}`,
          `Discord ID：${removed.userId}`,
          "燕雲 UID 綁定與歷史資料：已保留",
          "Discord 弟子／長老身分組：已撤銷"
        ].join("\n"),
        true
      );
    }

    const member = await setMemberRank(
      env,
      actor,
      subOption(interaction, "player"),
      subOption(interaction, "rank"),
      subOption(interaction, "note") || "",
      (userId, rank) => syncDiscordMemberRank(
        env,
        interaction.guild_id,
        userId,
        rank
      )
    );

    return immediateResponse(
      [
        "✅ 已調整成員身分。",
        `成員：${member.displayName}`,
        `Discord ID：${member.userId}`,
        `新身分：${RANK_LABEL[member.rank] || member.rank}`,
        "Discord 身分組：已同步"
      ].join("\n"),
      true
    );
  } catch (error) {
    return immediateResponse(
      `❌ ${error.message}`,
      true
    );
  }
}
