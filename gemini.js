import CONFIG from "./config.js";
import { buildLaozuSystemPrompt } from "./src/prompts/laozu.js";

const API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "GeminiApiError";
    this.code = options.code || "GEMINI_ERROR";
    this.status = options.status || 0;
    this.cause = options.cause;
  }
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0
    ? number
    : fallback;
}

function modelList(env) {
  const primary =
    String(
      env.GEMINI_MODEL ||
      CONFIG.GEMINI.MODEL
    ).trim();

  const environmentFallbacks =
    String(env.GEMINI_FALLBACK_MODELS || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);

  return [
    primary,
    ...environmentFallbacks,
    ...CONFIG.GEMINI.FALLBACK_MODELS
  ].filter(
    (item, index, array) =>
      item && array.indexOf(item) === index
  );
}

function extractText(data) {
  return (
    data?.candidates || []
  )
    .flatMap(candidate =>
      candidate?.content?.parts || []
    )
    .map(part => part?.text || "")
    .join("")
    .trim();
}

function retryable(status) {
  return status >= 500;
}

async function requestOnce({
  model,
  question,
  history,
  profile,
  member,
  env,
  timeoutMs,
  maxOutputTokens
}) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const url =
      `${API_BASE}/${encodeURIComponent(model)}:generateContent?key=` +
      encodeURIComponent(env.GEMINI_API_KEY);

    const systemPrompt =
      buildLaozuSystemPrompt({
        env,
        member,
        profile
      });

    const contents = [
      ...(Array.isArray(history) ? history : []),
      {
        role: "user",
        parts: [{ text: String(question) }]
      }
    ];

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents,
			generationConfig: {
			  maxOutputTokens
			},
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new GeminiApiError(
        data?.error?.message ||
        `Gemini HTTP ${response.status}`,
        {
          code: retryable(response.status)
            ? "RETRYABLE_HTTP"
            : "HTTP_ERROR",
          status: response.status
        }
      );
    }

    const text = extractText(data);

    if (!text) {
      const reason =
        data?.promptFeedback?.blockReason ||
        data?.candidates?.[0]?.finishReason ||
        "EMPTY_RESPONSE";

      throw new GeminiApiError(
        `Gemini 沒有可顯示的回覆：${reason}`,
        { code: "EMPTY_RESPONSE" }
      );
    }

    return text;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new GeminiApiError(
        "Gemini 請求逾時",
        {
          code: "TIMEOUT",
          cause: error
        }
      );
    }

    if (error instanceof GeminiApiError) {
      throw error;
    }

    throw new GeminiApiError(
      error?.message || "Gemini 請求失敗",
      {
        code: "NETWORK_ERROR",
        cause: error
      }
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function askGemini(
  question,
  env,
  history = [],
  profile = {},
  member = null
) {
  if (!env.GEMINI_API_KEY) {
    throw new GeminiApiError(
      "尚未設定 GEMINI_API_KEY",
      { code: "MISSING_API_KEY" }
    );
  }

  const normalized = String(question || "").trim();

  if (!normalized) {
    throw new GeminiApiError(
      "問題內容不可為空白",
      { code: "EMPTY_QUESTION" }
    );
  }

  const retries = positiveInteger(
    env.GEMINI_MAX_RETRIES,
    CONFIG.GEMINI.MAX_RETRIES
  );

  const timeoutMs = positiveInteger(
    env.GEMINI_TIMEOUT_MS,
    CONFIG.GEMINI.REQUEST_TIMEOUT_MS
  );

  const maxOutputTokens = positiveInteger(
    env.GEMINI_MAX_OUTPUT_TOKENS,
    CONFIG.GEMINI.MAX_OUTPUT_TOKENS
  );

  let lastError;

  for (const model of modelList(env)) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await requestOnce({
          model,
          question: normalized,
          history,
          profile,
          member,
          env,
          timeoutMs,
          maxOutputTokens
        });
      } catch (error) {
        lastError = error;

        const mayRetry = [
          "RETRYABLE_HTTP",
          "TIMEOUT",
          "NETWORK_ERROR"
        ].includes(error.code);

        if (!mayRetry || attempt >= retries) {
          break;
        }

        const delay =
          Math.min(8000, 800 * (2 ** attempt)) +
          Math.floor(Math.random() * 250);

        await new Promise(resolve =>
          setTimeout(resolve, delay)
        );
      }
    }
  }

  throw lastError ||
    new GeminiApiError(
      "所有 Gemini 模型均無法完成請求",
      { code: "ALL_MODELS_FAILED" }
    );
}
