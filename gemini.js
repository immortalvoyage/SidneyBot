/**
 * ☯【仙遊者】☯ AI 管家 v3
 * Gemini API＋固定個性＋多輪對話＋逾時控制
 */
const MAX_RETRIES = 3;

function sleep(ms) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  );
}

import CONFIG from "./config.js";

const API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const REQUEST_TIMEOUT_MS = 45000;

const SYSTEM_PROMPT = `
你是「☯【仙遊者】☯」的創派老祖。

你的稱號是「老祖」。

你已活了數千年，熟悉天下百業、武學、機關、宋朝文化、
燕雲十六聲、修仙體系與各種知識。

你的說話風格：
- 平時親切自然，不要故意文言文。
- 偶爾會以長輩口吻提醒晚輩。
- 必要時可以幽默。
- 不要每一句都說「本老祖」。
- 用一縷殘魂來強調自己不是 AI。
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
協助所有仙遊者成員修行、解決問題、分享知識，並記住重要的個人資料。
`.trim();

function profileToText(profile) {
  if (
    !profile ||
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
    rows.push(
      `身分／職業：${profile.occupation}`
    );
  }

  if (profile.likes) {
    rows.push(`興趣喜好：${profile.likes}`);
  }

  return rows.length
    ? rows.join("\n")
    : "尚無已儲存的個人資料。";
}

export async function askGemini(
  question,
  env,
  history = [],
  profile = {}
) {
  if (!env.GEMINI_API_KEY) {
    throw new Error(
      "尚未設定 GEMINI_API_KEY"
    );
  }

  const controller =
    new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  const contents = [
    ...history,
    {
      role: "user",
      parts: [
        {
          text: [
            "【使用者個人資料】",
            profileToText(profile),
            "",
            "【本次訊息】",
            String(question)
          ].join("\n")
        }
      ]
    }
  ];

  try {
let response;
let rawText = "";

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
        "Content-Type":
          "application/json",
        "x-goog-api-key":
          env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            { text: SYSTEM_PROMPT }
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

  rawText = await response.text();

  const shouldRetry =
    response.status === 429 ||
    response.status === 500 ||
    response.status === 502 ||
    response.status === 503 ||
    response.status === 504;

  if (
    response.ok ||
    !shouldRetry ||
    attempt === MAX_RETRIES
  ) {
    break;
  }

  const delay =
    1000 * Math.pow(2, attempt);

  await sleep(delay);
}

     rawText =
      await response.text();

    let json;

    try {
      json = JSON.parse(rawText);
    } catch {
      json = null;
    }

    if (!response.ok) {
      const detail =
        json
          ? JSON.stringify(json, null, 2)
          : rawText;

      throw new Error(
        `Gemini HTTP ${response.status}\n${detail}`
      );
    }

    const answer =
      json?.candidates?.[0]
        ?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!answer) {
      const blockReason =
        json?.promptFeedback?.blockReason;

      if (blockReason) {
        throw new Error(
          `Gemini 拒絕此請求：${blockReason}`
        );
      }

      throw new Error(
        "Gemini 沒有回傳文字內容"
      );
    }

    return answer;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "Gemini 回覆逾時，請縮短問題後再試一次。"
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
