/**
 * ☯【仙遊者】☯ AI 管家 v3
 * Discord Interaction / Webhook
 */

import CONFIG from "./config.js";
import { splitMessage } from "./utils.js";
import { logInfo, logError } from "./logger.js";

const API_BASE = "https://discord.com/api/v10";

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}

/**
 * 修改 Deferred 的原始回覆
 */
export async function editReply(
  applicationId,
  interactionToken,
  content
) {
  const response = await fetch(
    `${API_BASE}/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content,
        allowed_mentions: {
          parse: []
        }
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    logError(
      "Discord 更新回覆失敗",
      `${response.status} ${detail}`
    );

    throw new Error(
      `Discord 更新回覆失敗：HTTP ${response.status}`
    );
  }
}

/**
 * 傳送 Follow-up
 */
export async function sendFollowup(
  applicationId,
  interactionToken,
  content,
  ephemeral = false
) {
  const response = await fetch(
    `${API_BASE}/webhooks/${applicationId}/${interactionToken}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content,
        flags: ephemeral ? 64 : 0,
        allowed_mentions: {
          parse: []
        }
      })
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    logError(
      "Discord Follow-up 失敗",
      `${response.status} ${detail}`
    );

    throw new Error(
      `Discord Follow-up 失敗：HTTP ${response.status}`
    );
  }
}

/**
 * 自動分段回覆
 *
 * 第一段會修改原始 Deferred 回覆；
 * 後續段落以 Follow-up 發送。
 */
export async function sendLongReply(
  applicationId,
  interactionToken,
  text,
  ephemeral = false
) {
  const safeText =
    String(text || "").trim() ||
    "⚠️ AI 沒有產生可顯示的內容。";

  const messages = splitMessage(
    safeText,
    CONFIG.DISCORD.MAX_MESSAGE_LENGTH
  );

  await editReply(
    applicationId,
    interactionToken,
    messages[0]
  );

  for (let index = 1; index < messages.length; index++) {
    await sendFollowup(
      applicationId,
      interactionToken,
      messages[index],
      ephemeral
    );
  }
}

/**
 * 延遲回覆
 *
 * ephemeral=false：公開
 * ephemeral=true：只有發出指令者可見
 */
export function deferredResponse(ephemeral = false) {
  return jsonResponse({
    type: 5,
    data: {
      flags: ephemeral ? 64 : 0
    }
  });
}

/**
 * 即時一般回覆
 */
export function immediateResponse(
  message,
  ephemeral = false
) {
  return jsonResponse({
    type: 4,
    data: {
      content: message,
      flags: ephemeral ? 64 : 0,
      allowed_mentions: {
        parse: []
      }
    }
  });
}

/**
 * Discord Endpoint Ping
 */
export function pingResponse() {
  return jsonResponse({
    type: 1
  });
}

export function logInteraction(command, user) {
  logInfo(`/${command}`, user);
}

export default {
  editReply,
  sendFollowup,
  sendLongReply,
  deferredResponse,
  immediateResponse,
  pingResponse,
  logInteraction
};
