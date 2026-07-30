/**
 * ==========================================================
 * ☯【仙遊者】☯ Discord AI Bot
 * utils.js
 * 共用工具函式
 * ==========================================================
 */

/**
 * 睡眠
 * @param {number} ms 毫秒
 */
export async function sleep(ms) {

  return new Promise(resolve => setTimeout(resolve, ms));

}

/**
 * 取得台灣時間字串
 */
export function getTaipeiTime() {

  return new Date().toLocaleString(
    "zh-TW",
    {
      timeZone: "Asia/Taipei",
      hour12: false
    }
  );

}

/**
 * 將 Discord 長訊息分段
 * @param {string} text
 * @param {number} maxLength
 * @returns {string[]}
 */
export function splitMessage(
  text,
  maxLength = 1900
) {

  if (!text) {
    return [""];
  }

  const result = [];

  let remaining = String(text);

  while (remaining.length > maxLength) {

    let index =
      remaining.lastIndexOf("\n", maxLength);

    if (index < 0) {

      index = maxLength;

    }

    result.push(
      remaining.substring(0, index)
    );

    remaining =
      remaining.substring(index).trimStart();

  }

  result.push(remaining);

  return result;

}

/**
 * 安全取得字串
 */
export function safeString(value) {

  if (
    value === undefined ||
    value === null
  ) {

    return "";

  }

  return String(value);

}

/**
 * Discord Markdown Escape
 */
export function escapeDiscord(text) {

  return safeString(text)

    .replaceAll("\\", "\\\\")

    .replaceAll("*", "\\*")

    .replaceAll("_", "\\_")

    .replaceAll("`", "\\`")

    .replaceAll("|", "\\|")

    .replaceAll("~", "\\~")

    .replaceAll(">", "\\>");

}

/**
 * 限制文字長度
 */
export function truncate(

  text,

  maxLength = 1900

) {

  text = safeString(text);

  if (
    text.length <= maxLength
  ) {

    return text;

  }

  return text.substring(
    0,
    maxLength - 3
  ) + "...";

}

/**
 * 產生 UUID
 */
export function uuid() {

  return crypto.randomUUID();

}

/**
 * 判斷是否為空字串
 */
export function isEmpty(value) {

  return (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  );

}

/**
 * JSON 安全解析
 */
export function parseJson(text) {

  try {

    return JSON.parse(text);

  } catch {

    return null;

  }

}

/**
 * 格式化錯誤
 */
export function formatError(error) {

  if (
    error instanceof Error
  ) {

    return error.message;

  }

  return safeString(error);

}

export default {

  sleep,

  getTaipeiTime,

  splitMessage,

  safeString,

  escapeDiscord,

  truncate,

  uuid,

  isEmpty,

  parseJson,

  formatError

};