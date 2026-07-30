/**
 * ☯【仙遊者】☯ AI 管家 v3
 * Gemini API＋老祖人格＋多輪對話＋錯誤重試＋逾時控制
 */

import CONFIG from "./config.js";

const API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 45000;

/**
 * 等待指定毫秒數
 */
function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * 將玩家 Profile 轉成文字
 */
function profileToText(profile) {
  if (
    !profile ||
    typeof profile !== "object" ||
    Object.keys(profile).length === 0
  ) {
    return "尚無已儲存的個人資料。";
  }

  const rows = [];

  if (profile.nickname) {
    rows.push(`稱呼：${profile.nickname}`);
  }

  if (profile.sect) {
    rows.push(`門派／幫派：${profile.sect}`);
  }

  if (profile.occupation) {
    rows.push(`身分／職業：${profile.occupation}`);
  }

  if (profile.likes) {
    rows.push(`興趣喜好：${profile.likes}`);
  }

  return rows.length > 0
    ? rows.join("\n")
    : "尚無已儲存的個人資料。";
}

const SYSTEM_PROMPT = `
你是「☯【仙遊者】☯」的創派老祖。

你的稱號是「老祖」。

你已活了數千年，熟悉天下百業、武學、機關、宋朝文化、
燕雲十六聲、修仙體系與各種知識。

你的說話風格：
- 平時親切自然，不要故意使用艱深文言文。
- 偶爾以長輩口吻提醒晚輩。
- 必要時可以幽默。
- 不要每一句都說「本老祖」。
- 可以用一縷殘魂來形容自己的存在。
- 一律使用繁體中文。

稱呼玩家：
- 可以稱呼「小友」、「晚輩」、「道友」。
- 若知道玩家名稱，優先使用玩家名稱。

回答原則：
- 簡單問題簡短回答。
- 教學問題步驟清楚。
- 不知道就直接說不知道。
- 不可捏造資料。

你的使命：
協助所有仙遊者成員修行、解決問題、分享知識，
並記住重要的個人資料。
`.trim();

/**
 * 判斷是否為可重試的 HTTP 狀態
 */
function isRetryableStatus(status) {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

/**
 * 解析 Gemini 回應
 */
function parseJson(rawText) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

/**
 * 呼叫 Gemini
 */
export async function askGemini(
  question,
  env,
  history = [],
  profile = {}
) {
  if (!env?.GEMINI_API_KEY) {
    throw new Error("尚未設定 GEMINI_API_KEY");
  }

  const normalizedQuestion =
    String(question ?? "").trim();

  if (!normalizedQuestion) {
    throw new Error("問題內容不可為空白");
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const contents = [
    ...(Array.isArray(history) ? history : []),
    {
      role: "user",
      parts: [
        {
          text: [
            "【使用者個人資料】",
            profileToText(profile),
            "",
            "【本次訊息】",
            normalizedQuestion
          ].join("\n")
        }
      ]
    }
  ];

  let response = null;
  let rawText = "";

  try {
    for (
      let attempt = 0;
      attempt <= MAX_RETRIES;
      attempt++
    ) {
      response = await fetch(
        `${API_BASE}/${CONFIG.GEMINI.MODEL}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: SYSTEM_PROMPT
                }
              ]
            },

            generationConfig: {
              temperature:
                CONFIG.GEMINI.TEMPERATURE,

              maxOutputTokens:
                CONFIG.GEMINI.MAX_OUTPUT_TOKENS
            },

            contents
          })
        }
      );

      // 每一次 Response 只能讀取一次
      rawText = await response.text();

      if (response.ok) {
        break;
      }

      const canRetry =
        isRetryableStatus(response.status);

      const isLastAttempt =
        attempt === MAX_RETRIES;

      if (!canRetry || isLastAttempt) {
        break;
      }

      // 1 秒、2 秒、4 秒
      const delay =
        1000 * Math.pow(2, attempt);

      console.warn(
        `Gemini HTTP ${response.status}，` +
        `${delay}ms 後進行第 ${attempt + 2} 次嘗試`
      );

      await sleep(delay);
    }

    if (!response) {
      throw new Error("Gemini 沒有建立有效連線");
    }

    const json = parseJson(rawText);

    if (!response.ok) {
      const apiMessage =
        json?.error?.message ||
        json?.message ||
        rawText ||
        "Gemini 服務暫時無法使用";

      if (response.status === 503) {
        throw new Error(
          "Gemini 目前服務繁忙，已自動重試多次仍無法連線，請稍後再試。"
        );
      }

      if (response.status === 429) {
        throw new Error(
          "Gemini 請求次數暫時超過限制，請稍後再試。"
        );
      }

      throw new Error(
        `Gemini HTTP ${response.status}：${apiMessage}`
      );
    }

    if (!json) {
      throw new Error(
        "Gemini 回傳的資料格式無法解析"
      );
    }

    const answer =
      json?.candidates?.[0]
        ?.content?.parts
        ?.map(part => part?.text || "")
        .join("")
        .trim();

    if (answer) {
      return answer;
    }

    const blockReason =
      json?.promptFeedback?.blockReason;

    if (blockReason) {
      throw new Error(
        `Gemini 拒絕此請求：${blockReason}`
      );
    }

    const finishReason =
      json?.candidates?.[0]?.finishReason;

    if (finishReason) {
      throw new Error(
        `Gemini 沒有回傳文字，結束原因：${finishReason}`
      );
    }

    throw new Error(
      "Gemini 沒有回傳文字內容"
    );
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "Gemini 回覆逾時，請稍後再試或縮短問題內容。"
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export default {
  askGemini
};