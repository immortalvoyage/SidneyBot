import {
  immediateResponse,
  sendChannelMessage
} from "../../discord.js";
import {
  getOptionValue,
  getUser,
  getDisplayName
} from "../../utils.js";

import { getMember } from "../sect/members.js";
import { createApplication } from "../sect/applications.js";
import { writeAudit } from "../sect/audit.js";
import { logError } from "../../logger.js";
import { applicationReviewComponents } from "../interactions/components.js";

export async function handleApply(interaction, env, ctx) {
  const user = getUser(interaction);
  const userId = String(user.id || "");

  if (!userId) {
    return immediateResponse(
      "❌ 無法取得你的 Discord ID。",
      true
    );
  }

  const member = await getMember(env, userId);

  if (member) {
    return immediateResponse(
      `✅ 你已是宗門成員，身分為：${member.rank}`,
      true
    );
  }

  const reason = String(
    getOptionValue(interaction, "reason") || ""
  ).trim();

  const result = await createApplication(env, {
    userId,
    username: user.username,
    displayName: getDisplayName(interaction),
    reason
  });

  if (!result.created) {
    return immediateResponse(
      "⏳ 你的入宗申請仍在等待審核，請勿重複提交。",
      true
    );
  }

  await writeAudit(env, {
    action: "application.created",
    actorId: userId,
    targetId: userId,
    details: { reason }
  });

  const notify = notifyReviewChannel(env, result.application);
  if (ctx?.waitUntil) {
    ctx.waitUntil(notify);
  } else {
    await notify;
  }

  return immediateResponse(
    [
      "✅ 入宗申請已送出。",
      "",
      `申請理由：${reason || "未填寫"}`,
      "請等待宗主或長老審核。"
    ].join("\n"),
    true
  );
}

async function notifyReviewChannel(env, application) {
  try {
    await sendChannelMessage(
      env.APPLICATION_REVIEW_CHANNEL_ID,
      env.DISCORD_BOT_TOKEN,
      [
        "📨 **收到新的仙遊者入宗申請**",
        `申請者：${application.displayName}`,
        `Discord 帳號：${application.username}`,
        `Discord ID：${application.userId}`,
        `申請理由：${application.reason || "未填寫"}`,
        `申請時間：${application.createdAt}`,
        "",
        "請點擊下方按鈕審核；`/review` 仍可作為備援。"
      ].join("\n"),
      { components: applicationReviewComponents(application.userId) }
    );
  } catch (error) {
    logError("入宗申請通知發送失敗", error);
  }
}
