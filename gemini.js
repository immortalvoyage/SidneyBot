/**
 * ☯【仙遊者】☯ AI 管家 V4
 *
 * Gemini API
 * ＋新版老祖人格
 * ＋多輪對話
 * ＋主模型／備援模型
 * ＋錯誤重試
 * ＋獨立逾時控制
 */

import CONFIG from "./config.js";

import {
  buildLaozuSystemPrompt
} from "./src/prompts/prompt-builder.js";

const API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 45000;

/**
 * Gemini API 錯誤。
 *
 * 保留 HTTP 狀態、錯誤代碼與模型名稱，
 * 方便 commands.js 顯示正確錯誤。
 */
export class GeminiApiError extends Error {
  constructor(
    message,
    {
      status = 0,
      code = "UNKNOWN",
      model = "",
      finishReason = ""
    } = {}
  ) {
    super(message);

    this.name = "GeminiApiError";
    this.status = status;
    this.code = code;
    this.model = model;
    this.finishReason = finishReason;
  }
}

/**
 * 等待指定毫秒。
 */
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 安全解析 JSON。
 */
function safeParseJson(text) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 讀取數字設定。
 */
function getPositiveInteger(
  value,
  fallback
) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    return fallback;
  }

  return Math.floor(number);
}

/**
 * 建立使用模型清單。
 */
function getModelList() {
  const models = [
    CONFIG?.GEMINI?.MODEL,
    CONFIG?.GEMINI?.FALLBACK_MODEL
  ]
    .map((model) =>
      typeof model === "string"
        ? model.trim()
        : ""
    )
    .filter(Boolean);

  return [...new Set(models)];
}

/**
 * Gemini 可重試狀態。
 */
function isRetryableStatus(status) {
  return [
    408,
    429,
    500,
    502,
    503,
    504
  ].includes(status);
}

/**
 * 這些狀態不用對同一模型一直重試，
 * 應立即切換備援模型或回報設定錯誤。
 */
function shouldSwitchModelImmediately(status) {
  return [
    400,
    404
  ].includes(status);
}

/**
 * 建立每次獨立的逾時請求。
 *
 * 注意：
 * AbortController 不可在多次重試間重複使用。
 */
async function fetchWithTimeout(
  url,
  options,
  timeoutMs
) {
  const controller =
    new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 將舊版 Profile 暫時轉換為
 * Prompt Builder 可理解的宗門身份。
 *
 * 等宗門權限接入後，
 * 這裡會改成使用真正的 member 資料。
 */
function buildTemporaryMember(profile) {
  const nickname =
    typeof profile?.preferredNickname === "string"
      ? profile.preferredNickname.trim()
      : typeof profile?.nickname === "string"
        ? profile.nickname.trim()
        : "";

  return {
    displayName:
      nickname || "未記名弟子",

    nickname:
      nickname || "弟子",

    rank: "disciple",
    active: true
  };
}

/**
 * 建立 Gemini contents。
 */
function buildContents(
  history,
  question
) {
  const normalizedHistory =
    Array.isArray(history)
      ? history.filter((item) => {
          return (
            item &&
            ["user", "model"].includes(
              item.role
            ) &&
            Array.isArray(item.parts)
          );
        })
      : [];

  return [
    ...normalizedHistory,
    {
      role: "user",
      parts: [
        {
          text: question
        }
      ]
    }
  ];
}

/**
 * 從 Gemini JSON 中提取回答文字。
 */
function extractAnswer(json) {
  const parts =
    json?.candidates?.[0]
      ?.content?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map((part) => {
      return typeof part?.text === "string"
        ? part.text
        : "";
    })
    .join("")
    .trim();
}

/**
 * 建立 Gemini 錯誤。
 */
function createApiError({
  response,
  json,
  rawText,
  model
}) {
  const status =
    response?.status || 0;

  const code =
    json?.error?.status ||
    json?.error?.code ||
    "UNKNOWN";

  const apiMessage =
    json?.error?.message ||
    json?.message ||
    rawText ||
    "Gemini 服務無法完成請求。";

  return new GeminiApiError(
    `Gemini ${model} 回覆失敗：${apiMessage}`,
    {
      status,
      code: String(code),
      model
    }
  );
}

/**
 * 使用單一模型呼叫 Gemini。
 */
async function requestModel({
  model,
  question,
  history,
  profile,
  env,
  maxRetries,
  timeoutMs,
  maxOutputTokens
}) {
  const systemPrompt =
    buildLaozuSystemPrompt({
      member:
        buildTemporaryMember(profile),

      profile
    });

  const contents =
    buildContents(
      history,
      question
    );

  const url =
    `${API_BASE}/` +
    `${encodeURIComponent(model)}` +
    ":generateContent";

  let lastError = null;

  for (
    let attempt = 1;
    attempt <= maxRetries;
    attempt++
  ) {
    try {
      const response =
        await fetchWithTimeout(
          url,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "x-goog-api-key":
                env.GEMINI_API_KEY
            },

            body: JSON.stringify({
              systemInstruction: {
                parts: [
                  {
                    text: systemPrompt
                  }
                ]
              },

              generationConfig: {
                maxOutputTokens
              },

              contents
            })
          },
          timeoutMs
        );

      /*
       * Response Body 只能讀取一次。
       */
      const rawText =
        await response.text();

      const json =
        safeParseJson(rawText);

      if (!response.ok) {
        const apiError =
          createApiError({
            response,
            json,
            rawText,
            model
          });

        lastError = apiError;

        console.error(
          "Gemini API 錯誤",
          {
            model,
            attempt,
            status:
              apiError.status,

            code:
              apiError.code,

            message:
              apiError.message
          }
        );

        if (
          shouldSwitchModelImmediately(
            response.status
          )
        ) {
          throw apiError;
        }

        const canRetry =
          isRetryableStatus(
            response.status
          );

        const isLastAttempt =
          attempt >= maxRetries;

        if (
          !canRetry ||
          isLastAttempt
        ) {
          throw apiError;
        }

        /*
         * 1 秒、2 秒、4 秒，
         * 再加入少量隨機延遲。
         */
        const delay =
          1000 *
            Math.pow(
              2,
              attempt - 1
            ) +
          Math.floor(
            Math.random() * 500
          );

        console.warn(
          `Gemini ${model} ` +
          `將於 ${delay}ms 後重試。`
        );

        await sleep(delay);

        continue;
      }

      if (!json) {
        throw new GeminiApiError(
          "Gemini 回傳內容不是有效的 JSON。",
          {
            status:
              response.status,

            code:
              "INVALID_JSON",

            model
          }
        );
      }

      const answer =
        extractAnswer(json);

      if (answer) {
        return answer;
      }

      const blockReason =
        json?.promptFeedback
          ?.blockReason;

      if (blockReason) {
        throw new GeminiApiError(
          `Gemini 拒絕此請求：${blockReason}`,
          {
            status:
              response.status,

            code:
              "BLOCKED",

            model
          }
        );
      }

      const finishReason =
        json?.candidates?.[0]
          ?.finishReason ||
        "UNKNOWN";

      if (
        finishReason === "MAX_TOKENS"
      ) {
        throw new GeminiApiError(
          "Gemini 因輸出長度限制而中止回答。",
          {
            status:
              response.status,

            code:
              "MAX_TOKENS",

            model,
            finishReason
          }
        );
      }

      throw new GeminiApiError(
        "Gemini 沒有回傳文字內容。",
        {
          status:
            response.status,

          code:
            "EMPTY_RESPONSE",

          model,
          finishReason
        }
      );
    } catch (error) {
      if (
        error?.name ===
        "AbortError"
      ) {
        lastError =
          new GeminiApiError(
            `Gemini ${model} 回覆逾時。`,
            {
              status: 408,
              code: "TIMEOUT",
              model
            }
          );

        console.error(
          "Gemini 請求逾時",
          {
            model,
            attempt,
            timeoutMs
          }
        );

        if (
          attempt >= maxRetries
        ) {
          throw lastError;
        }

        const delay =
          1000 *
          Math.pow(
            2,
            attempt - 1
          );

        await sleep(delay);

        continue;
      }

      if (
        error instanceof
        GeminiApiError
      ) {
        throw error;
      }

      lastError =
        new GeminiApiError(
          error?.message ||
          "Gemini 連線發生未知錯誤。",
          {
            status: 0,
            code:
              "NETWORK_ERROR",

            model
          }
        );

      console.error(
        "Gemini 網路錯誤",
        {
          model,
          attempt,
          message:
            lastError.message
        }
      );

      if (
        attempt >= maxRetries
      ) {
        throw lastError;
      }

      const delay =
        1000 *
        Math.pow(
          2,
          attempt - 1
        );

      await sleep(delay);
    }
  }

  throw (
    lastError ||
    new GeminiApiError(
      `Gemini ${model} 無法完成請求。`,
      {
        code: "UNKNOWN",
        model
      }
    )
  );
}

/**
 * 對外主要函式。
 *
 * 保持原本的呼叫方式：
 *
 * askGemini(
 *   question,
 *   env,
 *   history,
 *   profile
 * )
 */
export async function askGemini(
  question,
  env,
  history = [],
  profile = {}
) {
  if (!env?.GEMINI_API_KEY) {
    throw new GeminiApiError(
      "尚未設定 GEMINI_API_KEY。",
      {
        code:
          "MISSING_API_KEY"
      }
    );
  }

  const normalizedQuestion =
    String(question ?? "")
      .trim();

  if (!normalizedQuestion) {
    throw new GeminiApiError(
      "問題內容不可為空白。",
      {
        code:
          "EMPTY_QUESTION"
      }
    );
  }

  const models =
    getModelList();

  if (models.length === 0) {
    throw new GeminiApiError(
      "config.js 尚未設定 Gemini 模型。",
      {
        code:
          "MISSING_MODEL"
      }
    );
  }

  const maxRetries =
    getPositiveInteger(
      CONFIG?.GEMINI
        ?.MAX_RETRIES,
      DEFAULT_MAX_RETRIES
    );

  const timeoutMs =
    getPositiveInteger(
      CONFIG?.GEMINI
        ?.REQUEST_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS
    );

  const maxOutputTokens =
    getPositiveInteger(
      CONFIG?.GEMINI
        ?.MAX_OUTPUT_TOKENS,
      1200
    );

  let lastError = null;

  for (const model of models) {
    try {
      console.log(
        `開始使用 Gemini 模型：${model}`
      );

      const answer =
        await requestModel({
          model,
          question:
            normalizedQuestion,

          history,
          profile,
          env,
          maxRetries,
          timeoutMs,
          maxOutputTokens
        });

      console.log(
        `Gemini 模型回覆成功：${model}`
      );

      return answer;
    } catch (error) {
      lastError = error;

      console.warn(
        `模型 ${model} 無法完成請求，` +
        "準備嘗試下一個模型。"
      );
    }
  }

  throw (
    lastError ||
    new GeminiApiError(
      "所有 Gemini 模型均無法完成請求。",
      {
        code:
          "ALL_MODELS_FAILED"
      }
    )
  );
}

export default {
  askGemini
};