import { askGemini } from "../../gemini.js";
import { deferredResponse, editOriginalResponse, immediateResponse } from "../../discord.js";
import { formatError, getUser } from "../../utils.js";
import { logError } from "../../logger.js";
import { resolveActor } from "../sect/service.js";
import { getPlayerState } from "../platform/player-state-storage.js";
import { reprimandPlayer } from "../platform/reprimand.js";

function subcommand(interaction) {
  return interaction?.data?.options?.[0] || null;
}

function subOption(interaction, name) {
  return subcommand(interaction)?.options?.find(item => item.name === name)?.value;
}

function fallbackText(targetName, reason) {
  return `${targetName}，同門相處須守分寸。${reason}。老祖今日鄭重提醒你，知錯便改，莫讓同門寒心。`;
}

async function generateReprimand(env, result) {
  const targetState = await getPlayerState(env, result.target.userId);
  const instruction = [
    "這是一項已由程式完成且由宗主授權的仙遊者訓誡。",
    `對象：${result.target.displayName || result.target.username}`,
    `原因：${result.reason}`,
    `好感變動：${result.previousFavor} → ${result.newFavor}`,
    "請以老祖嚴肅、克制、不羞辱人的語氣寫 2 至 4 句公開訓誡。",
    "只輸出訓誡正文；不要自行增加處罰、不要輸出 Discord @mention、不要聲稱未執行。"
  ].join("\n");

  try {
    return await askGemini(instruction, env, [], {}, result.target, targetState);
  } catch (error) {
    logError("老祖訓誡文字生成失敗，改用安全範本", error);
    return fallbackText(result.target.displayName || result.target.username, result.reason);
  }
}

async function execute(interaction, env) {
  const actor = await resolveActor(env, getUser(interaction));
  const result = await reprimandPlayer(env, {
    interactionId: interaction.id,
    actor,
    targetUserId: subOption(interaction, "player"),
    favorDeduction: subOption(interaction, "affection"),
    reason: subOption(interaction, "reason")
  });
  const text = await generateReprimand(env, result);
  const duplicateNotice = result.duplicate ? "\n\nℹ️ 此指令已執行過，未重複扣除好感。" : "";
  return {
    targetUserId: result.target.userId,
    content: [
      `<@${result.target.userId}> ${text}`,
      "",
      `好感度：${result.previousFavor} → ${result.newFavor}（${result.favorDelta}）`,
      `稽核紀錄：\`${result.auditId}\`${duplicateNotice}`
    ].join("\n")
  };
}

export async function handleLaozu(interaction, env, ctx) {
  if (subcommand(interaction)?.name !== "reprimand") {
    return immediateResponse("❌ 不支援的 /laozu 子指令。", true);
  }

  if (!ctx?.waitUntil) {
    try {
      const result = await execute(interaction, env);
      return immediateResponse(result.content, false);
    } catch (error) {
      return immediateResponse(`❌ ${formatError(error)}`, true);
    }
  }

  ctx.waitUntil((async () => {
    try {
      const result = await execute(interaction, env);
      await editOriginalResponse(interaction.application_id, interaction.token, result.content, {
        allowedUserIds: [result.targetUserId]
      });
    } catch (error) {
      logError("老祖訓誡背景執行失敗", error);
      await editOriginalResponse(
        interaction.application_id,
        interaction.token,
        `❌ ${formatError(error)}`
      );
    }
  })());

  return deferredResponse(false);
}
