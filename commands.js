/**
 * ☯【仙遊者】☯ AI 管家 v3
 *
 * /ai      公開
 * /help    公開
 * /profile 私密
 * /forget  私密
 */

import { askGemini, GeminiApiError } from "./gemini.js";

import {
  deferredResponse,
  immediateResponse,
  sendLongReply,
  logInteraction
} from "./discord.js";

import {
  logError,
  logInfo
} from "./logger.js";

import {
  formatError
} from "./utils.js";

import {
  loadMemory,
  saveMemory,
  loadProfile,
  updateProfileFromMessage,
  clearAllMemory,
  formatProfile
} from "./memory.js";

export function handleCommand(
  interaction,
  env,
  ctx
) {
  const command =
    interaction.data?.name;

  switch (command) {
    case "help":
      return handleHelp();

    case "ai":
      return handleAsk(
        interaction,
        env,
        ctx
      );

    case "profile":
      return handleProfile(
        interaction,
        env,
        ctx
      );

    case "forget":
      return handleForget(
        interaction,
        env,
        ctx
      );

    default:
      return immediateResponse(
        "❌ 找不到此指令。",
        true
      );
  }
}

function handleHelp() {
  return immediateResponse(
    [
      "☯【仙遊者】☯ AI 管家 v3",
      "",
      "可用指令：",
      "• `/ai question:你的問題`－公開與老祖聊天",
      "• `/profile`－私密查看 AI 記住的個人資料",
      "• `/forget`－私密清除自己的所有記憶",
      "• `/help`－公開查看使用說明",
      "",
      "記憶範例：",
      "• 我叫凜冬皓月",
      "• 我的門派是青溪",
      "• 我喜歡宋朝建築"
    ].join("\n"),
    false
  );
}

function getIdentity(interaction) {
  return {
    userId:
      interaction.member?.user?.id ||
      interaction.user?.id,

    guildId:
      interaction.guild_id ||
      "direct-message",

    username:
      interaction.member?.user
        ?.global_name ||
      interaction.member?.user
        ?.username ||
      interaction.user?.global_name ||
      interaction.user?.username ||
      "未知使用者"
  };
}

/**
 * /ai：立刻公開 Deferred，
 * 不在回傳前執行 Gemini 或 KV。
 */
function handleAsk(
  interaction,
  env,
  ctx
) {
  const question =
    getOptionValue(
      interaction,
      "question"
    );

  if (
    !question ||
    String(question).trim() === ""
  ) {
    return immediateResponse(
      "❌ 請輸入問題。",
      true
    );
  }

  const { username } =
    getIdentity(interaction);

  logInteraction("ai", username);

  ctx.waitUntil(
    processAsk(
      interaction,
      String(question).trim(),
      env
    )
  );

  /**
   * false = 公開回覆
   */
  return deferredResponse(false);
}

async function processAsk(
  interaction,
  question,
  env
) {
  const {
    userId,
    guildId
  } = getIdentity(interaction);

  try {
    if (!userId) {
      throw new Error(
        "無法取得 Discord 使用者 ID"
      );
    }

    logInfo("讀取 AI 記憶");

    const history =
      await loadMemory(
        env,
        guildId,
        userId
      );

    const profile =
      await updateProfileFromMessage(
        env,
        guildId,
        userId,
        question
      );

    logInfo("開始詢問 Google Gemini");

    const answer =
      await askGemini(
        question,
        env,
        history,
        profile
      );

    /**
     * 優先回覆 Discord，避免讓 KV 寫入
     * 延遲使用者看到答案。
     */
const publicMessage = [
  "### ☯ 小輩提問",
  String(question)
    .split("\n")
    .map(line => `> ${line}`)
    .join("\n"),
  "",
  "### ☯ 老祖回答",
  answer
].join("\n");

await sendLongReply(
  interaction.application_id,
  interaction.token,
  publicMessage,
  false
);

    logInfo("Discord 回覆完成");

    /**
     * 回覆成功後才保存對話。
     */
    try {
      await saveMemory(
        env,
        guildId,
        userId,
        question,
        answer
      );

      logInfo("KV 記憶儲存完成");
    } catch (memoryError) {
      logError(
        "KV 記憶儲存失敗",
        memoryError
      );
    }
  } catch (error) {
    logError(
      "Gemini 指令執行失敗",
      error
    );

    try {
      const errorMessage = buildGeminiErrorMessage(error);

      await sendLongReply(
        interaction.application_id,
        interaction.token,
        errorMessage,
        false
      );
    } catch (replyError) {
      logError(
        "Discord 錯誤訊息也無法送出",
        replyError
      );
    }
  }
}

function buildGeminiErrorMessage(error) {
  const status =
    error instanceof GeminiApiError
      ? error.status
      : 0;

  const code =
    error instanceof GeminiApiError
      ? error.code
      : "UNKNOWN";

  if (status === 429) {
    return [
      "⚠️ 老祖今日接收的傳音過多，Gemini 額度或速率暫時受限。",
      "",
      "請稍候片刻再使用 `/ai`。",
      "",
      `錯誤代碼：${status} ${code}`
    ].join("\n");
  }

  if ([500, 502, 503, 504].includes(status)) {
    return [
      "⚠️ 老祖目前有點忙碌，Google Gemini 服務暫時不穩定。",
      "",
      "程式已自動重試並切換備援模型，但仍未成功。",
      "請稍候片刻後再次使用 `/ai`。",
      "",
      `錯誤代碼：${status || "未知"} ${code}`
    ].join("\n");
  }

  if (status === 401 || status === 403) {
    return [
      "⚠️ Gemini API 金鑰或專案權限設定有誤。",
      "",
      "請檢查 Cloudflare Worker Secret：`GEMINI_API_KEY`。",
      "",
      `錯誤代碼：${status} ${code}`
    ].join("\n");
  }

  if (status === 404) {
    return [
      "⚠️ 目前設定的 Gemini 模型不存在或已停止提供。",
      "",
      "請檢查 `config.js` 內的模型名稱。",
      "",
      `錯誤代碼：${status} ${code}`
    ].join("\n");
  }

  return [
    "⚠️ 老祖傳音時發生未預期錯誤。",
    "",
    "請查看 Cloudflare Workers Logs 取得詳細原因。",
    "",
    `錯誤代碼：${status || "未知"} ${code}`
  ].join("\n");
}

/**
 * /profile：私密
 */
function handleProfile(
  interaction,
  env,
  ctx
) {
  const {
    userId,
    guildId,
    username
  } = getIdentity(interaction);

  logInteraction("profile", username);

  ctx.waitUntil(
    processProfile(
      interaction,
      env,
      guildId,
      userId
    )
  );

  return deferredResponse(true);
}

async function processProfile(
  interaction,
  env,
  guildId,
  userId
) {
  try {
    const profile =
      await loadProfile(
        env,
        guildId,
        userId
      );

    await sendLongReply(
      interaction.application_id,
      interaction.token,
      formatProfile(profile),
      true
    );
  } catch (error) {
    await sendLongReply(
      interaction.application_id,
      interaction.token,
      `❌ 讀取個人資料失敗：\n${formatError(error)}`,
      true
    );
  }
}

/**
 * /forget：私密
 */
function handleForget(
  interaction,
  env,
  ctx
) {
  const {
    userId,
    guildId,
    username
  } = getIdentity(interaction);

  logInteraction("forget", username);

  ctx.waitUntil(
    processForget(
      interaction,
      env,
      guildId,
      userId
    )
  );

  return deferredResponse(true);
}

async function processForget(
  interaction,
  env,
  guildId,
  userId
) {
  try {
    await clearAllMemory(
      env,
      guildId,
      userId
    );

    await sendLongReply(
      interaction.application_id,
      interaction.token,
      "✅ 已清除你的近期對話與長期個人資料記憶。",
      true
    );
  } catch (error) {
    await sendLongReply(
      interaction.application_id,
      interaction.token,
      `❌ 清除記憶失敗：\n${formatError(error)}`,
      true
    );
  }
}

function getOptionValue(
  interaction,
  name
) {
  const options =
    interaction.data?.options || [];

  for (const option of options) {
    if (option.name === name) {
      return option.value;
    }
  }

  return "";
}

export default {
  handleCommand
};
