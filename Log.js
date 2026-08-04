/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Log.gs
 *
 * 功能：
 * 1. 統一使用 CONFIG.SHEETS.LOG
 * 2. 將舊「更新日誌」資料合併至「Log」
 * 3. 寫入更新執行紀錄
 **************************************************/

/**************************************************
 * 取得或建立正式 Log 工作表
 *
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 **************************************************/
function getLogSheet() {

  // 取得目前試算表
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // 正式名稱固定讀取 Config.gs
  const sheetName = CONFIG.SHEETS.LOG;

  // 取得正式 Log 工作表
  let sheet = spreadsheet.getSheetByName(sheetName);

  // 正式 Log 不存在時自動建立
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  // 取得標題設定
  const headers = CONFIG.HEADER_LOG;

  // 正式寫入標題列
  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers]);

  // 凍結標題列
  sheet.setFrozenRows(1);

  // 套用標題樣式
  sheet
    .getRange(1, 1, 1, headers.length)
    .setFontWeight("bold")
    .setBackground(COLORS.HEADER)
    .setFontColor(COLORS.HEADER_FONT)
    .setHorizontalAlignment("center");

  return sheet;
}


/**************************************************
 * 寫入更新日誌
 *
 * @param {number} activeCount 可用數量
 * @param {number} expiredCount 已失效數量
 * @param {number} newCount 新增數量
 * @param {number} duration 執行耗時
 * @param {string} result 執行結果
 **************************************************/
function writeLog(
  activeCount,
  expiredCount,
  newCount,
  duration,
  result
) {

  // 取得正式 Log 工作表
  const sheet = getLogSheet();

  // 寫入一筆紀錄
  sheet.appendRow([
    new Date(),
    Number(activeCount) || 0,
    Number(expiredCount) || 0,
    Number(newCount) || 0,
    Number(duration) || 0,
    String(result || "SUCCESS")
  ]);

  // 取得新增列位置
  const lastRow = sheet.getLastRow();

  // 設定時間格式
  sheet
    .getRange(lastRow, 1)
    .setNumberFormat("yyyy/MM/dd HH:mm:ss");

  // 設定數字格式
  sheet
    .getRange(lastRow, 2, 1, 4)
    .setNumberFormat("0");

  // 強制提交變更
  SpreadsheetApp.flush();
}


/**************************************************
 * 合併舊版更新日誌
 *
 * 功能：
 * 1. 將「更新日誌」資料搬到「Log」
 * 2. 避免重複搬移標題列
 * 3. 搬移完成後刪除舊工作表
 **************************************************/
function migrateUpdateLogToLog() {

  // 取得目前試算表
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // 舊版工作表名稱
  const legacySheetName = "更新日誌";

  // 取得舊版工作表
  const legacySheet = spreadsheet.getSheetByName(
    legacySheetName
  );

  // 取得正式 Log 工作表
  const logSheet = getLogSheet();

  // 舊工作表不存在時直接結束
  if (!legacySheet) {

    spreadsheet.toast(
      "找不到舊版更新日誌，無須搬移",
      CONFIG.APP.TOAST_TITLE,
      5
    );

    return;
  }

  // 取得舊表最後資料列
  const legacyLastRow = legacySheet.getLastRow();

  // 取得舊表最後資料欄
  const legacyLastColumn = legacySheet.getLastColumn();

  // 舊表有資料列時執行搬移
  if (
    legacyLastRow > 1 &&
    legacyLastColumn > 0
  ) {

    // 正式 Log 固定使用六欄
    const targetColumnCount = CONFIG.HEADER_LOG.length;

    // 避免舊表欄數超出正式欄數
    const sourceColumnCount = Math.min(
      legacyLastColumn,
      targetColumnCount
    );

    // 讀取舊表資料，不包含標題列
    const legacyValues = legacySheet
      .getRange(
        2,
        1,
        legacyLastRow - 1,
        sourceColumnCount
      )
      .getValues();

    // 將不足六欄的資料補成六欄
    const normalizedValues = legacyValues.map(
      function (row) {

        // 複製原始資料，避免修改來源陣列
        const normalizedRow = row.slice();

        // 補足正式欄位數
        while (
          normalizedRow.length < targetColumnCount
        ) {
          normalizedRow.push("");
        }

        return normalizedRow;
      }
    );

    // 取得正式 Log 下一個可寫入位置
    const targetStartRow = Math.max(
      logSheet.getLastRow() + 1,
      2
    );

    // 批次寫入舊版紀錄
    logSheet
      .getRange(
        targetStartRow,
        1,
        normalizedValues.length,
        targetColumnCount
      )
      .setValues(normalizedValues);

    // 套用日期格式
    logSheet
      .getRange(
        targetStartRow,
        1,
        normalizedValues.length,
        1
      )
      .setNumberFormat("yyyy/MM/dd HH:mm:ss");

    // 套用數字格式
    logSheet
      .getRange(
        targetStartRow,
        2,
        normalizedValues.length,
        4
      )
      .setNumberFormat("0");
  }

  // 刪除重複的舊版工作表
  spreadsheet.deleteSheet(legacySheet);

  // 強制提交變更
  SpreadsheetApp.flush();

  // 顯示完成提示
  spreadsheet.toast(
    "更新日誌已合併至 Log",
    CONFIG.APP.TOAST_TITLE,
    5
  );
}


/**************************************************
 * 測試正式 Log
 **************************************************/
function testLog() {

  // 寫入測試紀錄
  writeLog(
    10,
    5,
    1,
    1234,
    "TEST SUCCESS"
  );

  // 顯示測試結果
  SpreadsheetApp
    .getActiveSpreadsheet()
    .toast(
      "測試資料已寫入 Log",
      CONFIG.APP.TOAST_TITLE,
      5
    );
}
