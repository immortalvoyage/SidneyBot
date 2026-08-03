import {
  getOptionValue,
  getUser
} from "../../utils.js";

import { resolveActor, approveApplicant } from "../sect/service.js";
import { syncDiscordMemberRank } from "../sect/discord-roles.js";
import { runDeferredCommand } from "./deferred.js";

export async function handleApprove(interaction, env, ctx) {
  const targetUserId = String(
    getOptionValue(interaction, "applicant") || ""
  ).trim();

  const note = String(
    getOptionValue(interaction, "note") || ""
  ).trim();

  if (!targetUserId) {
    return runDeferredCommand(interaction, null, "入宗核准", async () => {
      throw new Error("請從待審申請選單選擇申請者。");
    });
  }

  return runDeferredCommand(interaction, ctx, "入宗核准", async () => {
    const actorUser = getUser(interaction);
    const actor = await resolveActor(env, actorUser);
    const member = await approveApplicant(
      env,
      actor,
      targetUserId,
      note,
      (userId, rank) => syncDiscordMemberRank(
        env,
        interaction.guild_id,
        userId,
        rank
      )
    );

    return [
        "✅ 已批准入宗。",
        `成員：${member.displayName}`,
        `Discord ID：${member.userId}`,
        `身分：${member.rank}`,
        "Discord 身分組：已同步為弟子"
      ].join("\n");
  });
}
