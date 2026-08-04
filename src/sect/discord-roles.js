import { replaceGuildMemberRoles } from "../../discord.js";
import { RANK } from "./constants.js";

function roleConfig(env) {
  const resident = String(env.DISCORD_RESIDENT_ROLE_ID || "").trim();
  const disciple = String(env.DISCORD_DISCIPLE_ROLE_ID || "").trim();
  const elder = String(env.DISCORD_ELDER_ROLE_ID || "").trim();
  if (!resident || !disciple || !elder || new Set([resident, disciple, elder]).size !== 3) {
    throw new Error("領民／門徒／長老 Discord 身分組 ID 尚未正確設定");
  }
  return { resident, disciple, elder };
}

export async function syncDiscordMemberRank(env, guildId, userId, rank) {
  const { resident, disciple, elder } = roleConfig(env);
  const desired = rank === RANK.RESIDENT
    ? [resident]
    : rank === RANK.DISCIPLE
    ? [disciple]
    : rank === RANK.ELDER
      ? [elder]
      : [];

  const result = await replaceGuildMemberRoles(
    guildId,
    userId,
    env.DISCORD_BOT_TOKEN,
    [resident, disciple, elder],
    desired
  );

  return {
    status: "success",
    desiredRank: rank || "removed",
    managedRoles: { resident, disciple, elder },
    previousRoles: result.previousRoles,
    currentRoles: result.roles
  };
}
