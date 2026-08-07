import { askGemini } from "../../gemini.js";
import { deferredResponse, editOriginalResponse, immediateResponse } from "../../discord.js";
import { formatError, getUser } from "../../utils.js";
import { logError } from "../../logger.js";
import { resolveActor } from "../sect/service.js";
import { getPlayerState } from "../platform/player-state-storage.js";
import { reprimandPlayer } from "../platform/reprimand.js";
import { ensureMaster, getMember, listMembers } from "../sect/members.js";
import {
  findMatchProfiles,
  publishMatchProfile,
  withdrawMatchProfile
} from "../platform/laozu-matchmaking.js";

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
  const action = subcommand(interaction)?.name;
  if (["offer", "match", "withdraw"].includes(action)) {
    try {
      const user = getUser(interaction);
      await ensureMaster(env, user);
      const member = await getMember(env, user.id);
      if (!member || member.active === false) {
        throw new Error("只有仙遊者正式成員可以使用老祖媒合");
      }
      const guildId = interaction.guild_id || "dm";

      if (action === "offer") {
        const profile = await publishMatchProfile(env, {
          guildId,
          member,
          skills: subOption(interaction, "skills"),
          availability: subOption(interaction, "availability"),
          note: subOption(interaction, "note"),
          consent: subOption(interaction, "consent")
        });
        return immediateResponse([
          "✅ 老祖已刊登你的自願協助資料。",
          `專長：${profile.skills}`,
          `方便時間：${profile.availability}`,
          "只有其他成員主動搜尋相符需求時才會顯示；可隨時使用 `/laozu withdraw` 撤回。"
        ].join("\n"), true);
      }

      if (action === "withdraw") {
        await withdrawMatchProfile(env, guildId, user.id);
        return immediateResponse("✅ 已撤回媒合資料，老祖不會再向其他成員顯示。", true);
      }

      const matches = await findMatchProfiles(env, {
        guildId,
        requesterId: user.id,
        need: subOption(interaction, "need"),
        members: await listMembers(env)
      });
      if (!matches.length) {
        return immediateResponse("目前沒有已同意公開且符合需求的仙友。本座不會拿未授權的私人資料硬湊人選。", true);
      }
      return immediateResponse([
        "## 老祖媒合結果",
        ...matches.map((item, index) => [
          `${index + 1}. **${item.displayName}**（<@${item.userId}>）`,
          `   專長：${item.skills}`,
          `   方便時間：${item.availability}`,
          item.note ? `   備註：${item.note}` : null
        ].filter(Boolean).join("\n")),
        "",
        "以上成員皆已主動同意公開媒合；請尊重對方時間，先禮貌詢問。"
      ].join("\n"), true);
    } catch (error) {
      return immediateResponse(`❌ ${formatError(error)}`, true);
    }
  }

  if (action !== "reprimand") {
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
