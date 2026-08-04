import { getGuildMember, sendLongReply } from "../../discord.js";
import { getUser } from "../../utils.js";
import { RANK, RANK_LABEL } from "../sect/constants.js";
import { syncDiscordMemberRank } from "../sect/discord-roles.js";
import { enrollMemberByMaster, resolveActor } from "../sect/service.js";
import { canManageRanks } from "../sect/permissions.js";

const JOIN_WORDS = /(?:加入|納入|收為|新增(?:為)?)(?:\s*(?:到|進|為))?\s*(?:☯【?)?仙遊者/;
const ELDER_WORDS = /(?:成為|任命為|設為|擔任)?\s*長老/;
const MENTION = /<@!?(\d{15,22})>/;

export function parseMasterEnrollmentDialogue(question) {
  const text = String(question || "").normalize("NFC").trim();
  if (!JOIN_WORDS.test(text)) return null;
  const mention = text.match(MENTION);
  if (!mention) {
    return { error: "請使用 Discord 的 @ 提及功能指定要加入的玩家。" };
  }
  return {
    targetUserId: mention[1],
    rank: ELDER_WORDS.test(text) ? RANK.ELDER : RANK.DISCIPLE,
    note: text
  };
}

export async function processMasterEnrollmentDialogue(interaction, instruction, env) {
  try {
    const actor = await resolveActor(env, getUser(interaction));
    if (!actor || !canManageRanks(actor.rank)) {
      throw new Error("只有宗主可以請老祖直接加入新成員");
    }
    const discordMember = await getGuildMember(
      interaction.guild_id,
      instruction.targetUserId,
      env.DISCORD_BOT_TOKEN
    );
    const user = discordMember.user || {};
    const targetUser = {
      id: instruction.targetUserId,
      username: user.username || "unknown",
      globalName: user.global_name || "",
      displayName: discordMember.nick || user.global_name || user.username || "未知仙友"
    };
    const result = await enrollMemberByMaster(
      env,
      actor,
      targetUser,
      instruction.rank,
      instruction.note,
      (userId, rank) => syncDiscordMemberRank(env, interaction.guild_id, userId, rank)
    );
    const member = result.member;
    const content = result.created
      ? [
          `✅ 宗主，${member.displayName} 已加入仙遊者。`,
          `身分：${RANK_LABEL[member.rank]}`,
          `Discord ID：${member.userId}`,
          "遊戲 UID：尚未綁定",
          "請玩家自行使用 `/遊戲 綁定`，或由宗主使用既有管理功能處理。"
        ].join("\n")
      : [
          `ℹ️ ${member.displayName} 已在仙遊者名冊中，未重複新增。`,
          `目前身分：${RANK_LABEL[member.rank] || member.rank}`,
          `Discord ID：${member.userId}`
        ].join("\n");
    await sendLongReply(interaction.application_id, interaction.token, content);
  } catch (error) {
    await sendLongReply(interaction.application_id, interaction.token, `❌ ${error.message}`);
  }
}
