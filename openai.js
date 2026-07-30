/**
 * ==========================================================
 * ☯【仙遊者】☯ Discord AI Bot
 * openai.js
 * OpenAI Responses API
 * ==========================================================
 */

import CONFIG from "./config.js";
import { logInfo, logError } from "./logger.js";

const OPENAI_API_URL =
  "https://api.openai.com/v1/responses";

/**
 * 呼叫 OpenAI
 * @param {string} question
 * @param {object} env Cloudflare Secrets
 * @returns {Promise<string>}
 */
export async function askChatGPT(question, env) {

  logInfo("開始呼叫 OpenAI API");

  const response = await fetch(
    OPENAI_API_URL,
    {
      method: "POST",

      headers: {

        Authorization:
          `Bearer ${env.OPENAI_API_KEY}`,

        "Content-Type":
          "application/json"

      },

      body: JSON.stringify({

        model:
          env.OPENAI_MODEL ||
          CONFIG.OPENAI.MODEL,

        instructions:
          CONFIG.AI.SYSTEM_PROMPT,

        input:
          question,

        max_output_tokens:
          CONFIG.OPENAI.MAX_OUTPUT_TOKENS

      })

    }
  );

  const json = await response.json();

  if (!response.ok) {

    logError(
      "OpenAI API 呼叫失敗",
      json
    );

    throw new Error(

      json?.error?.message ||

      `HTTP ${response.status}`

    );

  }

  const answer =
    extractOutput(json);

  logInfo("OpenAI 回覆完成");

  return answer;

}

/**
 * 解析 Responses API 回傳內容
 */
function extractOutput(json) {

  if (

    typeof json.output_text === "string"

  ) {

    return json.output_text.trim();

  }

  let result = "";

  for (

    const item of json.output || []

  ) {

    if (

      item.type !== "message"

    ) {

      continue;

    }

    for (

      const content of item.content || []

    ) {

      if (

        content.type === "output_text"

      ) {

        result +=

          content.text;

      }

      if (

        content.type === "text"

      ) {

        result +=

          content.text;

      }

    }

  }

  if (

    result.trim() === ""

  ) {

    return "OpenAI 沒有回傳內容。";

  }

  return result.trim();

}

export default {

  askChatGPT

};