import { askGemini } from "./gemini.js";

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
  canUseAI
} from "./src/sect/permissions.js";

import { handleApply } from "./src/commands/apply.js";
import { handleApprove } from "./src/commands/approve.js";
import { handleReject } from "./src/commands/reject.js";
import { handleMembers } from "./src/commands/members.js";
import { handleSect } from "./src/commands/sect.js";
import { handleProfile } from "./src/commands/profile.js";
import { handleForget } from "./src/commands/forget.js";

export async function handleCommand(
  interaction,
  env,
  ctx
) {
  const command = interaction.data?.name;

  try {
    switch (command) {
      case "ai":
        return handleAsk(interaction, env, ctx);

      case "apply":
        return await handleApply(interaction, env);

      case "approve":
        return await handleApprove(interaction, env);

      case "reject":
        return await handleReject(interaction, env);

      case "members":
        return await handleMembers(interaction, env);

      case "sect":
        return await handleSect(interaction, env);

      case "profile":
        return await handleProfile(interaction, env);

      case "forget":
        return await handleForget(interaction, env);

      case "help":
        return handleHelp(env);

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

function handleHelp(env) {
  return immediateResponse(
    [
      `## ${env.SECT_NAME || "☯【仙遊者】☯"} AI Bot`,
      "",
      "`/ai question:<問題>`：宗門成員向老祖提問",
      "`/apply reason:<理由>`：申請入宗",
      "`/sect`：查看宗門狀態與自己的身分",
      "`/members`：查看宗門名冊",
      "`/profile`：查看個人與宗門資料",
      "`/forget`：清除自己的 AI 記憶",
      "`/approve user_id:<ID>`：宗主／長老批准申請",
      "`/reject user_id:<ID>`：宗主／長老拒絕申請",
      "",
      "請勿輸入密碼、Token、API Key 或其他機密資料。"
    ].join("\n"),
    true
  );
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

    const [history, profile] = await Promise.all([
      loadMemory(env, guildId, userId),
      loadProfile(env, guildId, userId)
    ]);

    const answer = await askGemini(
      question,
      env,
      history,
      profile,
      member
    );

    await saveMemory(
      env,
      guildId,
      userId,
      question,
      answer
    );

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
