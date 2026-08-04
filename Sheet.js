/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Sheet.gs
 **************************************************/

/**
 * 建立所有工作表
 */
function createSheets() {

  createDashboardSheet();
  createActiveSheet();
  createExpiredSheet();
  createNewSheet();
  createHistorySheet();
  createLogSheet();

}


/**************************************************
 * Dashboard
 **************************************************/

function createDashboardSheet() {

  const sheet = getSheet(CONFIG.SHEETS.DASHBOARD);

  if (sheet.getLastRow() > 0) return;

  sheet.getRange("A1").setValue(getAppName());
  sheet.getRange("A2").setValue(getAppVersion());

  dashboardRow(sheet,3,"最後更新","");
  dashboardRow(sheet,4,"API 狀態","");
  dashboardRow(sheet,5,"可用兌換碼","");
  dashboardRow(sheet,6,"已失效兌換碼","");
  dashboardRow(sheet,7,"本次新增","");
  dashboardRow(sheet,8,"累積新增","");
  dashboardRow(sheet,9,"更新耗時(ms)","");

  sheet.setColumnWidth(1,160);
  sheet.setColumnWidth(2,220);

}


/**************************************************
 * Active
 **************************************************/

function createActiveSheet(){

  const sheet = getSheet(CONFIG.SHEETS.ACTIVE);

  if(sheet.getLastRow()==0){

    setHeader(
      sheet,
      CONFIG.HEADER_ACTIVE
    );

    sheet.setFrozenRows(1);

  }

}


/**************************************************
 * Expired
 **************************************************/

function createExpiredSheet(){

  const sheet=getSheet(CONFIG.SHEETS.EXPIRED);

  if(sheet.getLastRow()==0){

    setHeader(
      sheet,
      CONFIG.HEADER_EXPIRED
    );

    sheet.setFrozenRows(1);

  }

}


/**************************************************
 * New
 **************************************************/

function createNewSheet(){

  const sheet=getSheet(CONFIG.SHEETS.NEW);

  if(sheet.getLastRow()==0){

    setHeader(
      sheet,
      CONFIG.HEADER_NEW
    );

    sheet.setFrozenRows(1);

  }

}


/**************************************************
 * History
 **************************************************/

function createHistorySheet(){

  const sheet=getSheet(CONFIG.SHEETS.HISTORY);

  if(sheet.getLastRow()==0){

    setHeader(
      sheet,
      CONFIG.HEADER_HISTORY
    );

    sheet.setFrozenRows(1);

  }

}


/**************************************************
 * Log
 **************************************************/

function createLogSheet(){

  const sheet=getSheet(CONFIG.SHEETS.LOG);

  if(sheet.getLastRow()==0){

    setHeader(
      sheet,
      CONFIG.HEADER_LOG
    );

    sheet.setFrozenRows(1);

  }

}

/**************************************************
 * 工作表名稱整理與遷移
 *
 * 功能：
 * 1. 將舊版工作表名稱遷移為目前 CONFIG 名稱
 * 2. 避免同功能工作表重複存在
 * 3. 保留資料較完整的工作表
 * 4. 刪除空白或重複的舊版工作表
 **************************************************/

function migrateLegacySheets() {

  // 取得目前試算表
  const spreadsheet = SpreadsheetApp.getActive();

  /**************************************************
   * 工作表名稱遷移設定
   **************************************************/

  const migrations = [
    {
      oldName: "已失效",
      newName: CONFIG.SHEETS.EXPIRED
    },
    {
      oldName: "更新日誌",
      newName: CONFIG.SHEETS.LOG
    }
  ];

  /**************************************************
   * 逐一處理舊版工作表
   **************************************************/

  migrations.forEach(function (migration) {

    // 取得舊版工作表
    const oldSheet = spreadsheet.getSheetByName(
      migration.oldName
    );

    // 取得目前正式工作表
    const newSheet = spreadsheet.getSheetByName(
      migration.newName
    );

    // 舊版工作表不存在時，不需要處理
    if (!oldSheet) {
      return;
    }

    /**************************************************
     * 正式工作表不存在
     **************************************************/

    if (!newSheet) {

      // 直接將舊版工作表重新命名
      oldSheet.setName(migration.newName);

      return;
    }

    /**************************************************
     * 正式與舊版工作表同時存在
     **************************************************/

    // 計算舊版工作表資料量
    const oldDataSize = getSheetDataSize_(oldSheet);

    // 計算正式工作表資料量
    const newDataSize = getSheetDataSize_(newSheet);

    // 舊版資料較多時，將資料遷移至正式工作表
    if (oldDataSize > newDataSize) {

      // 取得舊版工作表完整資料
      const oldValues = oldSheet
        .getDataRange()
        .getValues();

      // 清除正式工作表舊資料
      newSheet.clearContents();

      // 寫入舊版工作表資料
      if (
        oldValues.length > 0 &&
        oldValues[0].length > 0
      ) {

        newSheet.getRange(
          1,
          1,
          oldValues.length,
          oldValues[0].length
        ).setValues(oldValues);

      }

    }

    // 刪除已完成遷移的舊版工作表
    spreadsheet.deleteSheet(oldSheet);

  });

  /**************************************************
   * 重新套用正式樣式
   **************************************************/

  applyStyles();

  // 立即提交試算表變更
  SpreadsheetApp.flush();

  // 顯示完成通知
  spreadsheet.toast(
    "重複工作表已完成整理",
    CONFIG.APP.TOAST_TITLE,
    5
  );

}


/**************************************************
 * 計算工作表有效資料量
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {number} 有效資料儲存格數量
 **************************************************/

function getSheetDataSize_(sheet) {

  // 工作表不存在時返回 0
  if (!sheet) {
    return 0;
  }

  // 取得工作表最後資料列
  const lastRow = sheet.getLastRow();

  // 取得工作表最後資料欄
  const lastColumn = sheet.getLastColumn();

  // 沒有資料時返回 0
  if (
    lastRow === 0 ||
    lastColumn === 0
  ) {
    return 0;
  }

  // 使用列數乘欄數判斷資料完整度
  return lastRow * lastColumn;

}
