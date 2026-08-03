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
import { handleMember } from "./src/commands/member.js";
import { handleSect } from "./src/commands/sect.js";
import { handleProfile } from "./src/commands/profile.js";
import { handleForget } from "./src/commands/forget.js";
import { handleGame } from "./src/commands/game.js";

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
        return await handleApply(interaction, env, ctx);

      case "approve":
        return await handleApprove(interaction, env);

      case "reject":
        return await handleReject(interaction, env);

      case "members":
        return await handleMembers(interaction, env);

      case "member":
        return await handleMember(interaction, env);

      case "sect":
        return await handleSect(interaction, env);

      case "profile":
        return await handleProfile(interaction, env);

      case "forget":
        return await handleForget(interaction, env);

      case "game":
        return await handleGame(interaction, env);

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
      "### 老祖與個人功能",
      "`/ai question:<問題>`：公開向老祖提問",
      "`/profile`：私密查看個人與仙遊者資料",
      "`/forget`：私密清除自己的 AI 對話記憶",
      "",
      "### 仙遊者成員功能",
      "`/apply reason:<理由>`：私密申請加入仙遊者",
      "`/sect`：私密查看仙遊者狀態與自己的身分",
      "`/members`：私密查看仙遊者名冊",
      "`/member get player:<名冊玩家>`：宗主查看成員詳細資料與燕雲綁定",
      "`/member set-rank player:<名冊玩家> rank:<弟子或長老> note:<備註>`：宗主調整正式成員身分",
      "`/member remove player:<名冊玩家> confirm:<確認移除> note:<備註>`：宗主將成員移出名冊（保留燕雲 UID 綁定與歷史資料）",
      "",
      "### 燕雲十六聲角色綁定",
      "`/game bind uid:<UID> character_name:<角色名稱>`：提交 UID 綁定申請",
      "`/game status`：查看自己的 UID 綁定狀態",
      "`/game pending`：宗主／長老查看待審 UID 綁定",
      "`/game approve user:<成員>`：宗主／長老核准 UID 綁定",
      "`/game reject user:<成員>`：宗主／長老拒絕 UID 綁定",
      "",
      "### 入門審核（宗主／長老）",
      "`/approve applicant:<待審申請者>`：從待審清單批准加入仙遊者",
      "`/reject applicant:<待審申請者>`：從待審清單拒絕加入仙遊者",
      "",
      "### 使用提醒",
      "成員管理會直接搜尋仙遊者 KV 名冊，不受 Discord 頻道成員選單限制。",
      "UID 綁定批准仍從 Discord 成員選單選擇申請者。",
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
