import { replaceGuildMemberRoles } from "../../discord.js";
import { RANK } from "./constants.js";

function roleConfig(env) {
  const disciple = String(env.DISCORD_DISCIPLE_ROLE_ID || "").trim();
  const elder = String(env.DISCORD_ELDER_ROLE_ID || "").trim();
  if (!disciple || !elder || disciple === elder) {
    throw new Error("弟子／長老 Discord 身分組 ID 尚未正確設定");
  }
  return { disciple, elder };
}

export async function syncDiscordMemberRank(env, guildId, userId, rank) {
  const { disciple, elder } = roleConfig(env);
  const desired = rank === RANK.DISCIPLE
    ? [disciple]
    : rank === RANK.ELDER
      ? [elder]
      : [];

  const result = await replaceGuildMemberRoles(
    guildId,
    userId,
    env.DISCORD_BOT_TOKEN,
    [disciple, elder],
    desired
  );

  return {
    status: "success",
    desiredRank: rank || "removed",
    managedRoles: { disciple, elder },
    previousRoles: result.previousRoles,
    currentRoles: result.roles
  };
}
