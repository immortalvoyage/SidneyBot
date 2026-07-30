/**
 * ==========================================================
 * ☯【仙遊者】☯ Discord AI Bot
 * logger.js
 * ==========================================================
 */

const PREFIX = "☯【仙遊者】☯";

function getTimestamp() {

  return new Date().toLocaleString(
    "zh-TW",
    {
      timeZone: "Asia/Taipei",
      hour12: false
    }
  );

}

function output(level, message, ...args) {

  const text =
    `[${getTimestamp()}] ${PREFIX} [${level}] ${message}`;

  switch (level) {

    case "ERROR":
      console.error(text, ...args);
      break;

    case "WARN":
      console.warn(text, ...args);
      break;

    case "DEBUG":
      console.debug(text, ...args);
      break;

    default:
      console.log(text, ...args);

  }

}

export function logInfo(message, ...args) {

  output("INFO", message, ...args);

}

export function logWarn(message, ...args) {

  output("WARN", message, ...args);

}

export function logError(message, ...args) {

  output("ERROR", message, ...args);

}

export function logDebug(message, ...args) {

  output("DEBUG", message, ...args);

}

export default {

  logInfo,
  logWarn,
  logError,
  logDebug

};