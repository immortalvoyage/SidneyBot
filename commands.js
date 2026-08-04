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
  canApprove,
  canManageRanks,
  canUseAI,
  canViewMembers
} from "./src/sect/permissions.js";

import { RANK_LABEL } from "./src/sect/constants.js";

import { handleApply } from "./src/commands/apply.js";
import { handleApprove } from "./src/commands/approve.js";
import { handleReject } from "./src/commands/reject.js";
import { handleMembers } from "./src/commands/members.js";
import { handleMember } from "./src/commands/member.js";
import { handleSect } from "./src/commands/sect.js";
import { handleProfile } from "./src/commands/profile.js";
import { handleForget } from "./src/commands/forget.js";
import { handleGame } from "./src/commands/game.js";
import { handleAudit } from "./src/commands/audit.js";
import { handleSystem } from "./src/commands/system.js";

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
        return await handleApprove(interaction, env, ctx);

      case "reject":
        return await handleReject(interaction, env);

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
        return await handleGame(interaction, env);

      case "audit":
        return await handleAudit(interaction, env);

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

async function handleHelp(interaction, env) {
  const user = getUser(interaction);
  await ensureMaster(env, user);
  const member = await getMember(env, user.id);
  const rank = member?.rank || null;

  const lines = [
    `## ${env.SECT_NAME || "☯【仙遊者】☯"} AI Bot`,
    `你的身分：${RANK_LABEL[rank] || "尚未入宗"}`,
    "",
    "### 目前可用指令",
    "英文與中文指令功能相同，例如 `/help` = `/幫助`。",
    "`/help`／`/幫助`：私密查看你目前能使用的指令",
    "`/profile view`／`/個人資料 查看`：私密查看個人與仙遊者資料",
    "`/forget`／`/忘記`：私密清除自己的 AI 對話記憶"
  ];

  if (!member) {
    lines.push(
      "`/apply reason:<理由>`：私密申請加入仙遊者"
    );
  }

  if (rank && canUseAI(rank)) {
    lines.push(
      "`/profile set-name name:<顯示名稱>`：修改自己的仙遊者名冊名稱",
      "`/ai question:<問題>`：公開向老祖提問",
      "`/sect`：私密查看仙遊者狀態與自己的身分",
      "`/members page:<頁碼>`：私密分頁查看仙遊者名冊",
      "`/game bind uid:<UID> character_name:<角色名稱>`：提交 UID 綁定申請",
      "`/game status`：查看自己的 UID 綁定狀態"
    );
  }

  if (rank && canApprove(rank)) {
    lines.push(
      "",
      "### 審核指令",
      "`/approve applicant:<待審申請者>`：批准加入仙遊者",
      "`/reject applicant:<待審申請者>`：拒絕加入仙遊者",
      "`/game pending`：查看待審 UID 綁定",
      "`/game approve applicant:<待審綁定>`：核准 UID 綁定",
      "`/game reject applicant:<待審綁定>`：拒絕 UID 綁定"
    );
  }

  if (rank && canManageRanks(rank)) {
    lines.push(
      "",
      "### 宗主管理指令",
      "`/member get player:<名冊玩家>`：查看成員詳細資料與燕雲綁定",
      "`/member set-rank player:<名冊玩家> rank:<弟子或長老> note:<備註>`：調整正式成員身分",
      "`/member remove player:<名冊玩家> confirm:<確認移除> note:<備註>`：將成員移出名冊",
      "`/audit recent`：查看最近 10 筆操作紀錄",
      "`/audit view record:<紀錄>`：查看單筆操作詳情",
      "`/system check`：檢查 KV 名冊與審核索引一致性",
      "`/system repair confirm:<確認修復>`：安全重建 KV 索引"
    );
  }

  if (rank && canViewMembers(rank)) {
    lines.push(
      "",
      "### 使用提醒",
      "畫面只列出你目前身分可使用的指令。",
      "權限以仙遊者即時名冊為準。"
    );
  }

  lines.push(
    "請勿輸入密碼、Token、API Key 或其他機密資料。"
  );

  return immediateResponse(
    lines.join("\n"),
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
