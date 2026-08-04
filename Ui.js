/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Ui.gs
 *
 * 職責：
 * 1. 統一管理 Google Sheets Toast
 * 2. 統一管理成功訊息
 * 3. 統一管理警告訊息
 * 4. 統一管理錯誤訊息
 **************************************************/

/**************************************************
 * 顯示一般提示
 *
 * @param {string} message 訊息內容
 * @param {number=} seconds 顯示秒數
 **************************************************/
function showToast(
  message,
  seconds
) {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    return;
  }

  spreadsheet.toast(
    String(message || ""),
    getAppToastTitle(),
    Number(seconds) || 5
  );
}


/**************************************************
 * 顯示成功提示
 *
 * @param {string} message 訊息內容
 * @param {number=} seconds 顯示秒數
 **************************************************/
function showSuccessToast(
  message,
  seconds
) {

  showToast(
    "✅ " + String(message || ""),
    Number(seconds) || 5
  );
}


/**************************************************
 * 顯示警告提示
 *
 * @param {string} message 訊息內容
 * @param {number=} seconds 顯示秒數
 **************************************************/
function showWarningToast(
  message,
  seconds
) {

  showToast(
    "⚠️ " + String(message || ""),
    Number(seconds) || 6
  );
}


/**************************************************
 * 顯示錯誤提示
 *
 * @param {string} message 訊息內容
 * @param {number=} seconds 顯示秒數
 **************************************************/
function showErrorToast(
  message,
  seconds
) {

  showToast(
    "❌ " + String(message || ""),
    Number(seconds) || 8
  );
}
