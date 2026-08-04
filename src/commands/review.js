import { getOptionValue, getUser } from "../../utils.js";
import { approveApplicant, rejectApplicant, resolveActor } from "../sect/service.js";
import { syncDiscordMemberRank } from "../sect/discord-roles.js";
import { runDeferredCommand } from "./deferred.js";

export async function handleReview(interaction, env, ctx) {
  const applicantId = String(getOptionValue(interaction, "applicant") || "").trim();
  const decision = String(getOptionValue(interaction, "decision") || "").trim();
  const note = String(getOptionValue(interaction, "note") || "").trim();

  if (!applicantId) {
    return runDeferredCommand(interaction, null, "入宗審核", async () => {
      throw new Error("請從待審申請選單選擇申請者。");
    });
  }

  return runDeferredCommand(interaction, ctx, "入宗審核", async () => {
    const actor = await resolveActor(env, getUser(interaction));

    if (decision === "approve") {
      const member = await approveApplicant(
        env,
        actor,
        applicantId,
        note,
        (userId, rank) => syncDiscordMemberRank(env, interaction.guild_id, userId, rank)
      );
      return [
        "✅ 已核准入宗申請。",
        `成員：${member.displayName}`,
        `Discord ID：${member.userId}`,
        "身分：弟子",
        "Discord 身分組：已同步為弟子",
        "遊戲 UID：尚未綁定"
      ].join("\n");
    }

    if (decision === "reject") {
      await rejectApplicant(env, actor, applicantId, note);
      return [
        "✅ 已拒絕入宗申請。",
        `Discord ID：${applicantId}`,
        `備註：${note || "無"}`
      ].join("\n");
    }

    throw new Error("請選擇核准或拒絕。");
  });
}
