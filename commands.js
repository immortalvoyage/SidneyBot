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
  canApplyForMembership,
  canManageRanks,
  canRequestUidBinding,
  canUseAI,
  canViewUidStatus,
  canViewMembers
} from "./src/sect/permissions.js";

import { RANK_LABEL } from "./src/sect/constants.js";
import { getPlayerState } from "./src/platform/player-state-storage.js";

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

async function handleHelp(interaction, env) {
  const user = getUser(interaction);
  await ensureMaster(env, user);
  const member = await getMember(env, user.id);
  const rank = member?.rank || null;
  const topic = String(getOptionValue(interaction, "topic") || "home");
  const lines = [
    `## ${env.SECT_NAME || "☯【仙遊者】☯"}使用說明`,
    `你的身分：**${RANK_LABEL[rank] || "尚未入宗"}**`
  ];

  if (topic === "home") {
    lines.push(...helpHome(rank));
  } else {
    lines.push(...helpTopic(topic, rank));
  }

  lines.push("", "*所有說明皆為私人訊息，其他玩家看不到。*");

  return immediateResponse(
    lines.join("\n"),
    true
  );
}

function helpHome(rank) {
  if (canApplyForMembership(rank)) {
    return [
      "### 下一步：申請加入",
      "`/apply`　提交仙遊者入門申請",
      "",
      "### 其他功能",
      "`/profile view`　查看自己的資料",
      "`/help topic:基本功能`　查看完整基本說明"
    ];
  }

  if (canRequestUidBinding(rank)) {
    return [
      "### 下一步：綁定遊戲角色",
      "`/game bind`　申請綁定《燕雲十六聲》UID",
      "`/game status`　查看審核進度",
      "",
      "### 日常使用",
      "`/ai`　向老祖提問",
      "`/profile view`　查看個人資料與萬象錄",
      "`/members`　查看仙遊者名冊",
      "",
      "更多說明：在 `/help` 選擇「遊戲綁定」或「基本功能」。"
    ];
  }

  const lines = [
    "### 常用功能",
    "`/ai`　向老祖提問",
    "`/profile view`　查看個人資料與萬象錄",
    "`/members`　查看仙遊者名冊",
    "`/game status`　查看遊戲綁定"
  ];

  if (canApprove(rank)) {
    lines.push(
      "",
      "### 待辦入口",
      "`/panel`　建立老祖互動面板",
      "在 `/help` 選擇「審核工作」查看審核指令。"
    );
  }

  if (canManageRanks(rank)) {
    lines.push(
      "在 `/help` 選擇「宗主管理」或「系統維護」查看進階功能。"
    );
  }

  lines.push("", "其他個人功能：在 `/help` 選擇「基本功能」。");
  return lines;
}

function helpTopic(topic, rank) {
  if (topic === "basic") {
    const lines = [
      "### 基本功能",
      "`/profile view`　查看個人資料與萬象錄",
      "`/forget`　清除自己的 AI 對話記憶"
    ];
    if (rank && canUseAI(rank)) {
      lines.push(
        "`/profile set-name`　修改名冊顯示名稱",
        "`/ai`　公開向老祖提問",
        "`/sect`　查看仙遊者狀態",
        "`/members`　查看仙遊者名冊"
      );
    } else {
      lines.push("`/apply`　提交仙遊者入門申請");
    }
    return lines;
  }

  if (topic === "game" && canViewUidStatus(rank)) {
    const lines = ["### 遊戲綁定"];
    if (canRequestUidBinding(rank)) {
      lines.push("`/game bind`　申請綁定自己的遊戲 UID");
    }
    lines.push("`/game status`　查看自己的綁定狀態");
    return lines;
  }

  if (topic === "review" && canApprove(rank)) {
    return [
      "### 審核工作",
      "`/review`　審核入門申請",
      "`/game pending`　查看待審 UID 綁定",
      "`/game review`　核准或拒絕 UID 綁定",
      "`/panel`　建立老祖互動面板"
    ];
  }

  if (topic === "admin" && canManageRanks(rank)) {
    return [
      "### 宗主管理",
      "`/member get`　查看成員詳細資料",
      "`/member set-rank`　調整成員身分",
      "`/member remove`　將成員移出名冊",
      "`/laozu reprimand`　公開訓誡並降低好感",
      "`/audit recent`　查看最近操作紀錄",
      "`/audit view`　查看單筆操作詳情"
    ];
  }

  if (topic === "system" && canManageRanks(rank)) {
    return [
      "### 系統維護",
      "`/system check`　檢查 KV 資料一致性（只讀）",
      "`/system repair`　重建 KV 索引",
      "",
      "⚠️ 修復前先執行 `/system check`，只有確認異常才使用 repair。"
    ];
  }

  return [
    "### 此分類目前無法使用",
    "你的身分沒有這項功能，請重新輸入 `/help` 查看可用入口。"
  ];
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
