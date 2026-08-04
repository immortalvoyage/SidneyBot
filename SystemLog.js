/**************************************************
 * WWM Redeem Code Tracker V2.0
 * SystemLog.gs
 *
 * 職責：
 * 1. 統一管理執行紀錄
 * 2. 統一管理錯誤紀錄
 * 3. 提供標準化日誌格式
 **************************************************/

/**************************************************
 * 寫入資訊日誌
 *
 * @param {string} message 訊息
 * @param {*=} data 附加資料
 **************************************************/
function systemLogInfo(
  message,
  data
) {

  writeSystemLog_(
    "INFO",
    message,
    data
  );
}


/**************************************************
 * 寫入警告日誌
 *
 * @param {string} message 訊息
 * @param {*=} data 附加資料
 **************************************************/
function systemLogWarning(
  message,
  data
) {

  writeSystemLog_(
    "WARNING",
    message,
    data
  );
}


/**************************************************
 * 寫入錯誤日誌
 *
 * @param {string|Error} error 錯誤資料
 * @param {*=} data 附加資料
 **************************************************/
function systemLogError(
  error,
  data
) {

  const errorMessage =
    error instanceof Error
      ? error.message
      : String(error || "");

  writeSystemLog_(
    "ERROR",
    errorMessage,
    data
  );
}


/**************************************************
 * 寫入標準化日誌
 *
 * @param {string} level 日誌等級
 * @param {string} message 訊息
 * @param {*=} data 附加資料
 **************************************************/
function writeSystemLog_(
  level,
  message,
  data
) {

  const timestamp =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm:ss"
    );

  let logText =
    "[" +
    timestamp +
    "] [" +
    String(level || "INFO") +
    "] " +
    String(message || "");

  if (
    data !== undefined &&
    data !== null
  ) {
    try {
      logText +=
        "｜" +
        JSON.stringify(data);
    } catch (error) {
      logText +=
        "｜" +
        String(data);
    }
  }

  console.log(logText);
}
