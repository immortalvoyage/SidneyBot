import { immediateResponse, updateMessageResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { recordDailyGreeting } from "../platform/daily-greeting.js";
import { approveApplicant, rejectApplicant, resolveActor } from "../sect/service.js";
import { syncDiscordMemberRank } from "../sect/discord-roles.js";
import { getApplication } from "../sect/applications.js";
import { notifyMember, notificationSummary, UID_BINDING_GUIDE } from "../sect/notifications.js";
import { canApprove, canUseAI } from "../sect/permissions.js";
import { getMember } from "../sect/members.js";
import { promoteResidentAfterUidApproval } from "../sect/service.js";
import { GAME_IDS } from "../platform/games/constants.js";
import {
  approveGameBinding,
  getBindingRequest,
  rejectGameBinding
} from "../platform/games/service.js";
import {
  COMPONENT_IDS,
  applicationReviewComponents,
  parseApplicationReviewId,
  parseUidReviewId,
  uidReviewComponents
} from "./components.js";
import { handleAdminInteraction, isAdminInteraction } from "./admin-panel.js";
import { handleRosterInteraction, isRosterInteraction } from "./roster.js";

export async function handleButton(interaction, env, ctx) {
  const customId = String(interaction.data?.custom_id || "");
  if (isRosterInteraction(customId)) return handleRosterInteraction(interaction, env);
  if (isAdminInteraction(customId)) return handleAdminInteraction(interaction, env, ctx);
  if (customId === COMPONENT_IDS.DAILY_GREETING) {
    return handleDailyGreeting(interaction, env);
  }

  const review = parseApplicationReviewId(customId);
  if (review) return handleApplicationReview(interaction, env, review);

  const uidReview = parseUidReviewId(customId);
  if (uidReview) return handleUidReview(interaction, env, uidReview);

  return immediateResponse("❌ 這個按鈕已失效，請聯絡宗主重新建立面板。", true);
}

async function handleUidReview(interaction, env, review) {
  const user = getUser(interaction);
  try {
    const actor = await resolveActor(env, user);
    if (!actor || !canApprove(actor.rank)) {
      return immediateResponse("❌ 你沒有審核 UID 綁定申請的權限。", true);
    }
    const request = await getBindingRequest(env, GAME_IDS.WWM, review.userId);
    if (!request || request.status !== "pending") {
      return immediateResponse("這份 UID 綁定申請已完成審核，請勿重複操作。", true);
    }
    const targetMember = await getMember(env, review.userId);
    if (!targetMember || !canUseAI(targetMember.rank)) {
      return immediateResponse("❌ 該申請者目前不是仙遊者正式成員，不能處理綁定。", true);
    }

    if (review.decision === "approve") {
      const account = await approveGameBinding(env, {
        gameId: GAME_IDS.WWM,
        userId: review.userId,
        reviewerId: actor.userId,
        note: "由 UID 審核按鈕核准"
      });
      let promoted = false;
      if (targetMember.rank === "resident") {
        await promoteResidentAfterUidApproval(
          env,
          actor,
          review.userId,
          "UID 綁定核准後自動升為門徒",
          (userId, rank) => syncDiscordMemberRank(env, interaction.guild_id, userId, rank)
        );
        promoted = true;
      }
      const notification = await notifyMember(env, {
        userId: review.userId,
        actorId: actor.userId,
        event: "game_binding.approved",
        content: [
          "✅ 你的《燕雲十六聲》UID 綁定已核准。",
          `UID：${account.uid}`,
          `角色名稱：${account.currentCharacterName}`,
          promoted ? "身分：已由領民自動升為門徒" : "身分：維持原身分"
        ].join("\n")
      });
      return completedUidReviewMessage(
        interaction,
        review.userId,
        actor,
        "✅ 已同意 UID 綁定",
        notification
      );
    }

    const rejected = await rejectGameBinding(env, {
      gameId: GAME_IDS.WWM,
      userId: review.userId,
      reviewerId: actor.userId,
      note: "由 UID 審核按鈕拒絕"
    });
    const notification = await notifyMember(env, {
      userId: review.userId,
      actorId: actor.userId,
      event: "game_binding.rejected",
      content: [
        "❌ 你的《燕雲十六聲》UID 綁定申請未獲核准。",
        `UID：${rejected.uid}`,
        "請確認 UID 與角色名稱後使用 `/game bind` 重新提交，或聯絡宗主。"
      ].join("\n")
    });
    return completedUidReviewMessage(
      interaction,
      review.userId,
      actor,
      "❌ 已拒絕 UID 綁定",
      notification
    );
  } catch (error) {
    return immediateResponse(`❌ ${error.message || "UID 審核失敗"}`, true);
  }
}

function completedUidReviewMessage(interaction, userId, actor, result, notification) {
  const original = String(interaction.message?.content || "").split("\n---\n")[0];
  const reviewer = actor.displayName || actor.username || actor.userId;
  return updateMessageResponse({
    content: [
      original,
      "---",
      `審核結果：${result}`,
      `審核者：${reviewer}`,
      `審核時間：${new Date().toISOString()}`,
      notificationSummary(notification)
    ].join("\n"),
    components: uidReviewComponents(userId, true)
  });
}

async function handleDailyGreeting(interaction, env) {
  try {
    const user = getUser(interaction);
    const result = await recordDailyGreeting(env, String(user.id || ""));
    if (!result.created) {
      return immediateResponse(
        `今日已請過安啦，莫非是想多討一次獎賞？\n連續 ${result.state.greeting.currentStreak} 天｜累計 ${result.state.greeting.totalDays} 天`,
        true
      );
    }
    return immediateResponse(
      `早呀，小傢伙。今日也有好好來見老祖，記住了。\n今日請安完成｜連續 ${result.state.greeting.currentStreak} 天｜好感 +1`,
      true
    );
  } catch (error) {
    return immediateResponse(`❌ ${error.message || "請安失敗"}`, true);
  }
}

async function handleApplicationReview(interaction, env, review) {
  const user = getUser(interaction);
  let actor;
  try {
    actor = await resolveActor(env, user);
    const application = await getApplication(env, review.userId);
    if (!application || application.status !== "pending") {
      return immediateResponse("這份申請已完成審核，請勿重複操作。", true);
    }

    if (review.decision === "approve") {
      const member = await approveApplicant(
        env,
        actor,
        review.userId,
        "由審核按鈕核准",
        (userId, rank) => syncDiscordMemberRank(env, interaction.guild_id, userId, rank)
      );
      await notifyMember(env, {
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
      return completedReviewMessage(interaction, application, actor, "✅ 已同意入宗");
    }

    const rejected = await rejectApplicant(env, actor, review.userId, "由審核按鈕拒絕");
    await notifyMember(env, {
      userId: review.userId,
      actorId: actor.userId,
      event: "application.rejected",
      content: [
        `❌ ${rejected.displayName || rejected.username || "仙友"}，你的仙遊者入宗申請未獲核准。`,
        "如有疑問，請直接聯絡宗主。"
      ].join("\n")
    });
    return completedReviewMessage(interaction, application, actor, "❌ 已拒絕申請");
  } catch (error) {
    return immediateResponse(`❌ ${error.message || "審核失敗"}`, true);
  }
}

function completedReviewMessage(interaction, application, actor, result) {
  const original = String(interaction.message?.content || "").split("\n---\n")[0];
  const reviewer = actor.displayName || actor.username || actor.userId;
  return updateMessageResponse({
    content: [
      original,
      "---",
      `審核結果：${result}`,
      `審核者：${reviewer}`,
      `審核時間：${new Date().toISOString()}`
    ].join("\n"),
    components: applicationReviewComponents(application.userId, true)
  });
}
