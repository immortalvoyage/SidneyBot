import { getOptionValue, getUser } from "../../utils.js";
import { approveApplicant, rejectApplicant, resolveActor } from "../sect/service.js";
import { syncDiscordMemberRank } from "../sect/discord-roles.js";
import { runDeferredCommand } from "./deferred.js";
import { notifyMember, notificationSummary, UID_BINDING_GUIDE } from "../sect/notifications.js";

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
      const notification = await notifyMember(env, {
        userId: member.userId,
        actorId: actor.userId,
        event: "application.approved",
        content: [
          `✅ ${member.displayName}，你的仙遊者入宗申請已核准。`,
          "身分：領民（完成 UID 綁定後自動成為門徒）",
          "遊戲 UID：尚未綁定",
          "",
          UID_BINDING_GUIDE
        ].join("\n")
      });
      return [
        "✅ 已核准入宗申請。",
        `成員：${member.displayName}`,
        `Discord ID：${member.userId}`,
        "身分：領民",
        "Discord 身分組：已同步為領民",
        "遊戲 UID：尚未綁定",
        notificationSummary(notification)
      ].join("\n");
    }

    if (decision === "reject") {
      const reviewed = await rejectApplicant(env, actor, applicantId, note);
      const notification = await notifyMember(env, {
        userId: applicantId,
        actorId: actor.userId,
        event: "application.rejected",
        content: [
          `❌ ${reviewed.displayName || reviewed.username || "仙友"}，你的仙遊者入宗申請未獲核准。`,
          `審核備註：${note || "未提供"}`,
          "如有疑問，請直接聯絡宗主。"
        ].join("\n")
      });
      return [
        "✅ 已拒絕入宗申請。",
        `Discord ID：${applicantId}`,
        `備註：${note || "無"}`,
        notificationSummary(notification)
      ].join("\n");
    }

    throw new Error("請選擇核准或拒絕。");
  });
}
