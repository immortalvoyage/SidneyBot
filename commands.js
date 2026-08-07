import { askGemini } from "./gemini.js";
import { recordLaozuSignal } from "./src/platform/laozu-mood-state.js";

import {
  deferredResponse,
  immediateResponse,
  sendLongReply
} from "./discord.js";

import {
  loadMemory,
  saveMemory,
  loadProfile
} from "./memory.js";

import {
  formatError,
  getOptionValue,
  getUser
} from "./utils.js";

import {
  logError,
  logInfo
} from "./logger.js";

import {
  ensureMaster,
  getMember
} from "./src/sect/members.js";

import {
  canApprove,
  canApplyForMembership,
  canManageRanks,
  canRequestUidBinding,
  canUseAI,
  canViewUidStatus,
  canViewMembers
} from "./src/sect/permissions.js";

import { RANK_LABEL } from "./src/sect/constants.js";
import { getPlayerState } from "./src/platform/player-state-storage.js";
import { canUseCommand } from "./src/commands/command-access.js";
import { handleHelp } from "./src/interactions/help-panel.js";

import { handleApply } from "./src/commands/apply.js";
import { handleReview } from "./src/commands/review.js";
import { handlePanel } from "./src/commands/panel.js";
import { handleMembers } from "./src/commands/members.js";
import { handleMember } from "./src/commands/member.js";
import { handleSect } from "./src/commands/sect.js";
import { handleProfile } from "./src/commands/profile.js";
import { handleForget } from "./src/commands/forget.js";
import { handleGame } from "./src/commands/game.js";
import { handleAudit } from "./src/commands/audit.js";
import { handleSystem } from "./src/commands/system.js";
import { handleLaozu } from "./src/commands/laozu.js";
import {
  parseMasterEnrollmentDialogue,
  processMasterEnrollmentDialogue
} from "./src/commands/master-dialogue.js";

export async function handleCommand(
  interaction,
  env,
  ctx
) {
  const command = interaction.data?.name;

  try {
    const accessUser = getUser(interaction);
    await ensureMaster(env, accessUser);
    const accessMember = await getMember(env, accessUser.id);
    if (!await canUseCommand(env, command, accessMember?.rank || null)) {
      return immediateResponse("❌ 你的身分目前沒有使用此指令的權限。請輸入 `/help` 查看可用功能。", true);
    }

    switch (command) {
      case "ai":
        return handleAsk(interaction, env, ctx);

      case "apply":
        return await handleApply(interaction, env, ctx);

      case "review":
        return await handleReview(interaction, env, ctx);
      case "panel":
        return await handlePanel(interaction, env);

      case "members":
        return await handleMembers(interaction, env);

      case "member":
        return await handleMember(interaction, env, ctx);

      case "sect":
        return await handleSect(interaction, env);

      case "profile":
        return await handleProfile(interaction, env);

      case "forget":
        return await handleForget(interaction, env);

      case "game":
        return await handleGame(interaction, env, ctx);

      case "audit":
        return await handleAudit(interaction, env);

      case "laozu":
        return await handleLaozu(interaction, env, ctx);

      case "system":
        return await handleSystem(interaction, env, ctx);

      case "help":
        return await handleHelp(interaction, env);

      default:
        return immediateResponse(
          "❌ 找不到此指令。",
          true
        );
    }
  } catch (error) {
    logError(`指令 ${command} 執行失敗`, error);

    return immediateResponse(
      `❌ 指令執行失敗：${formatError(error)}`,
      true
    );
  }
}

async function handleAsk(interaction, env, ctx) {
  const question = String(
    getOptionValue(interaction, "question") || ""
  ).trim();

  if (!question) {
    return immediateResponse(
      "❌ 請輸入問題。",
      true
    );
  }

  const enrollment = parseMasterEnrollmentDialogue(question);
  if (enrollment) {
    if (enrollment.error) {
      return immediateResponse(`❌ ${enrollment.error}`, true);
    }
    ctx.waitUntil(processMasterEnrollmentDialogue(interaction, enrollment, env));
    return deferredResponse(true);
  }

  const user = getUser(interaction);
  await ensureMaster(env, user);

  const member = await getMember(env, user.id);

  if (!member || !canUseAI(member.rank)) {
    return immediateResponse(
      [
        "❌ 你目前沒有使用 AI 老祖的權限。",
        "請先使用 `/apply` 申請加入宗門。"
      ].join("\n"),
      true
    );
  }

  ctx.waitUntil(
    processAsk(
      interaction,
      question,
      member,
      env
    )
  );

  return deferredResponse(false);
}

async function processAsk(
  interaction,
  question,
  member,
  env
) {
  const guildId = interaction.guild_id || "dm";
  const userId = member.userId;

  try {
    logInfo("開始詢問 Gemini", {
      userId,
      rank: member.rank
    });

    const [history, profile, playerState] = await Promise.all([
      loadMemory(env, guildId, userId),
      loadProfile(env, guildId, userId),
      getPlayerState(env, userId)
    ]);

    const answer = await askGemini(
      question,
      env,
      history,
      profile,
      member,
      playerState
    );

    await saveMemory(
      env,
      guildId,
      userId,
      question,
      answer
    );

    await recordLaozuSignal(env, {
      type: "meaningful_chat",
      actorId: userId,
      eventId: `chat:${userId}:${new Date().toISOString().slice(0, 10)}`
    });

    await sendLongReply(
      interaction.application_id,
      interaction.token,
      answer
    );

    logInfo("Gemini 回覆完成", { userId });
  } catch (error) {
    logError("Gemini 指令執行失敗", error);

    await sendLongReply(
      interaction.application_id,
      interaction.token,
      `❌ Gemini API 發生錯誤：\n${formatError(error)}`
    );
  }
}

export default {
  handleCommand
};
