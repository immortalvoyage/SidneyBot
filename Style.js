/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Style.gs
 *
 * Dashboard 與所有資料工作表的樣式
 **************************************************/

const UI_STYLE = {
  NAVY: "#162A46",
  NAVY_LIGHT: "#203B61",
  BLUE: "#1976D2",
  BLUE_LIGHT: "#E3F2FD",
  GREEN: "#2E7D32",
  GREEN_LIGHT: "#E8F5E9",
  RED: "#C62828",
  RED_LIGHT: "#FFEBEE",
  AMBER: "#F9A825",
  AMBER_LIGHT: "#FFF8E1",
  PURPLE: "#6A1B9A",
  PURPLE_LIGHT: "#F3E5F5",
  TEAL: "#00796B",
  TEAL_LIGHT: "#E0F2F1",
  WHITE: "#FFFFFF",
  TEXT: "#263238",
  MUTED: "#607D8B",
  BORDER: "#CFD8DC",
  BACKGROUND: "#F4F7FA"
};


/**************************************************
 * 套用全部樣式
 **************************************************/

function applyStyles() {

  styleDashboard();

  applyDashboardConditionalFormatting();

  styleActiveSheet();

  styleExpiredSheet();

  styleNewSheet();

  styleHistorySheet();

  styleLogSheet();


}


/**************************************************
 * Dashboard
 **************************************************/

/**************************************************
 * Dashboard 樣式
 * 配合目前 Dashboard.gs 的儲存格配置
 **************************************************/

function styleDashboard() {

  const sheet = getSheet(CONFIG.SHEETS.DASHBOARD);

  if (!sheet) {
    throw new Error("找不到 Dashboard 工作表");
  }

  sheet.getRange("A9:D15").breakApart();

  sheet.getRange("C9:D15")
    .clearFormat()
    .setBackground(UI_STYLE.BACKGROUND)
    .setFontColor(UI_STYLE.TEXT)
    .setBorder(
      false,
      false,
      false,
      false,
      false,
      false
    );

  // 基本設定
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(2);

  // 整體背景
  sheet.getRange("A1:H30")
    .setBackground(UI_STYLE.BACKGROUND)
    .setFontFamily("Arial")
    .setFontColor(UI_STYLE.TEXT)
    .setVerticalAlignment("middle");

  /**************************************************
   * 主標題
   **************************************************/

  sheet.getRange("A1:H1")
    .setBackground(UI_STYLE.NAVY)
    .setFontColor(UI_STYLE.WHITE)
    .setFontSize(22)
    .setFontWeight("bold")
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle");

  sheet.setRowHeight(1, 48);

  /**************************************************
   * 副標題
   **************************************************/

  sheet.getRange("A2:H2")
    .setBackground(UI_STYLE.NAVY_LIGHT)
    .setFontColor(UI_STYLE.WHITE)
    .setFontSize(11)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.setRowHeight(2, 30);

  /**************************************************
   * 統計資料
   **************************************************/

  // 目前可用
  styleDashboardStat_(
    sheet,
    4,
    UI_STYLE.GREEN_LIGHT,
    UI_STYLE.GREEN
  );

  // 已失效
  styleDashboardStat_(
    sheet,
    5,
    UI_STYLE.RED_LIGHT,
    UI_STYLE.RED
  );

  // 總數
  styleDashboardStat_(
    sheet,
    6,
    UI_STYLE.TEAL_LIGHT,
    UI_STYLE.TEAL
  );

  // 強制恢復數字格式
  sheet.getRange("B4:B6")
    .setNumberFormat("0");

  /**************************************************
   * 最後更新時間
   **************************************************/

  sheet.getRange("A8:B8")
    .setBackground(UI_STYLE.GREEN_LIGHT)
    .setBorder(
      true,
      true,
      true,
      true,
      false,
      false,
      UI_STYLE.GREEN,
      SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );

  sheet.getRange("A8")
    .setFontColor(UI_STYLE.GREEN)
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("left");

  sheet.getRange("B8")
    .setFontColor(UI_STYLE.GREEN)
    .setFontWeight("bold")
    .setFontSize(16)
    .setHorizontalAlignment("left")
    .setNumberFormat("yyyy/MM/dd HH:mm:ss");

  sheet.setRowHeight(8, 38);

  /**************************************************
   * Dashboard 狀態卡片
   **************************************************/

  // Dashboard 狀態卡片
  [
    { row: 9, bg: UI_STYLE.GREEN_LIGHT, color: UI_STYLE.GREEN },
    { row: 10, bg: UI_STYLE.BLUE_LIGHT, color: UI_STYLE.BLUE },
    { row: 11, bg: UI_STYLE.AMBER_LIGHT, color: UI_STYLE.AMBER },
    { row: 12, bg: UI_STYLE.PURPLE_LIGHT, color: UI_STYLE.PURPLE },
    { row: 13, bg: UI_STYLE.TEAL_LIGHT, color: UI_STYLE.TEAL },
    { row: 14, bg: UI_STYLE.BLUE_LIGHT, color: UI_STYLE.BLUE }
  ].forEach(function (card) {

    styleEmptyDashboardCard_(
      sheet,
      card.row,
      card.bg,
      card.color
    );

  });
  // 數字格式
  sheet.getRange("B10:B13")
    .setNumberFormat("0");

  sheet.getRange("B14")
    .setNumberFormat('0.00 "秒"');

  // 列高
  for (let row = 9; row <= 14; row++) {
    sheet.setRowHeight(row, 34);
  }

  /**************************************************
   * 最近新增兌換碼
   **************************************************/

  // 避免重複合併產生錯誤
  sheet.getRange("A16:D16").breakApart();

  sheet.getRange("A16:D16")
    .merge()
    .setValue("✨ 最近新增兌換碼")
    .setBackground(UI_STYLE.NAVY)
    .setFontColor(UI_STYLE.WHITE)
    .setFontSize(12)
    .setFontWeight("bold")
    .setHorizontalAlignment("left")
    .setVerticalAlignment("middle");

  sheet.setRowHeight(16, 32);

  sheet.getRange("A17:D22")
    .setBackground(UI_STYLE.WHITE)
    .setFontColor(UI_STYLE.TEXT)
    .setFontSize(11)
    .setVerticalAlignment("middle")
    .setBorder(
      true,
      true,
      true,
      true,
      true,
      true,
      UI_STYLE.BORDER,
      SpreadsheetApp.BorderStyle.SOLID
    );

  for (let row = 17; row <= 21; row++) {
    sheet.setRowHeight(row, 30);
  }

  // 兌換碼區
  sheet.getRange("A17:B21")
    .setFontWeight("bold")
    .setHorizontalAlignment("left")
    .setFontColor(UI_STYLE.NAVY);

  sheet.getRange("C17:D21")
    .setFontWeight("normal")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setFontColor(UI_STYLE.MUTED)
    .setNumberFormat("yyyy/MM/dd HH:mm");

  /**************************************************
   * 系統資訊
   **************************************************/

  styleSystemInfoCard_(sheet);

  /**************************************************
   * Dashboard 欄寬
   **************************************************/

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 245);
  sheet.setColumnWidth(3, 95);
  sheet.setColumnWidth(4, 95);
  sheet.setColumnWidth(5, 20);
  sheet.setColumnWidth(6, 85);
  sheet.setColumnWidth(7, 135);
  sheet.setColumnWidth(8, 20);

  // 統計列高度
  [4, 5, 6, 9, 10, 11, 12, 13, 14].forEach(function (row) {
    sheet.setRowHeight(row, 34);
  });

}

/**************************************************
 * Dashboard 統計列
 **************************************************/

function styleDashboardStat_(
  sheet,
  row,
  backgroundColor,
  accentColor
) {

  sheet.getRange(row, 1, 1, 2)
    .setBackground(backgroundColor)
    .setBorder(
      true,
      true,
      true,
      true,
      false,
      false,
      accentColor,
      SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );

  sheet.getRange(row, 1)
    .setFontColor(accentColor)
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("left");

  sheet.getRange(row, 2)
    .setFontColor(accentColor)
    .setFontWeight("bold")
    .setFontSize(18)
    .setHorizontalAlignment("right");

}


/**************************************************
 * Dashboard 預留資訊列
 **************************************************/

/**************************************************
 * Dashboard 狀態卡片樣式
 **************************************************/

function styleEmptyDashboardCard_(
  sheet,
  row,
  backgroundColor,
  accentColor
) {

  // 先清除舊框線
  sheet.getRange(row, 1, 1, 2)
    .setBorder(
      false,
      false,
      false,
      false,
      false,
      false
    );

  // 再繪製一次
  sheet.getRange(row, 1, 1, 2)
    .setBackground(backgroundColor)
    .setBorder(
      true,
      true,
      true,
      true,
      false,
      false,
      accentColor,
      SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );

  sheet.getRange(row, 1)
    .setFontColor(accentColor)
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("left");

  sheet.getRange(row, 2)
    .setFontColor(UI_STYLE.TEXT)
    .setFontWeight("bold")
    .setFontSize(16)
    .setHorizontalAlignment("right");

}


/**
 * Dashboard 狀態資料列
 */
function styleInfoRow_(sheet, row, background, accent) {

  sheet.getRange(row, 1, 1, 2)
    .setBackground(background)
    .setBorder(
      true,
      true,
      true,
      true,
      false,
      false,
      accent,
      SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );

  sheet.getRange(row, 1)
    .setFontWeight("bold")
    .setFontColor(accent)
    .setFontSize(11);

  sheet.getRange(row, 2)
    .setFontWeight("bold")
    .setFontColor(UI_STYLE.TEXT)
    .setFontSize(11)
    .setHorizontalAlignment("right");

}


/**
 * Dashboard 統計資料列
 */
function styleStatisticRow_(sheet, row, background, accent) {

  sheet.getRange(row, 1, 1, 2)
    .setBackground(background)
    .setBorder(
      true,
      true,
      true,
      true,
      false,
      false,
      accent,
      SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );

  sheet.getRange(row, 1)
    .setFontColor(accent)
    .setFontWeight("bold")
    .setFontSize(12);

  sheet.getRange(row, 2)
    .setFontColor(accent)
    .setFontWeight("bold")
    .setFontSize(18)
    .setHorizontalAlignment("right");

}


/**************************************************
 * 可用兌換碼
 **************************************************/

function styleActiveSheet() {

  const sheet = getSheet(CONFIG.SHEETS.ACTIVE);

  styleDataSheet_(
    sheet,
    CONFIG.HEADER_ACTIVE.length,
    UI_STYLE.GREEN,
    UI_STYLE.GREEN_LIGHT,
    [2, 3]
  );

}


/**************************************************
 * 已失效兌換碼
 **************************************************/

function styleExpiredSheet() {

  const sheet = getSheet(CONFIG.SHEETS.EXPIRED);

  styleDataSheet_(
    sheet,
    CONFIG.HEADER_EXPIRED.length,
    UI_STYLE.RED,
    UI_STYLE.RED_LIGHT,
    [2, 3, 4]
  );

}


/**************************************************
 * 新增兌換碼工作表樣式
 **************************************************/

function styleNewSheet() {

  // 取得新增兌換碼工作表
  const sheet = getSheet(CONFIG.SHEETS.NEW);

  // 工作表不存在時停止執行
  if (!sheet) {
    return;
  }

  // 套用新增事件紀錄表樣式
  styleDataSheet_(
    sheet,
    CONFIG.HEADER_NEW.length,
    UI_STYLE.AMBER,
    UI_STYLE.AMBER_LIGHT,
    [1, 3, 4]
  );

  // 設定更新批次欄位寬度
  sheet.setColumnWidth(5, 175);

  // 更新批次使用置中顯示
  const lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    sheet.getRange(2, 5, lastRow - 1, 1)
      .setHorizontalAlignment("center")
      .setFontColor(UI_STYLE.MUTED);
  }

}


/**************************************************
 * 歷史紀錄
 **************************************************/

function styleHistorySheet() {

  const sheet = getSheet(CONFIG.SHEETS.HISTORY);

  styleDataSheet_(
    sheet,
    CONFIG.HEADER_HISTORY.length,
    UI_STYLE.PURPLE,
    UI_STYLE.PURPLE_LIGHT,
    [3, 4, 5, 6, 7]
  );

}


/**************************************************
 * Log
 **************************************************/

function styleLogSheet() {

  const sheet = getSheet(CONFIG.SHEETS.LOG);

  styleDataSheet_(
    sheet,
    CONFIG.HEADER_LOG.length,
    UI_STYLE.TEAL,
    UI_STYLE.TEAL_LIGHT,
    [1]
  );

}


/**************************************************
 * 共用資料表樣式
 **************************************************/

function styleDataSheet_(
  sheet,
  columnCount,
  headerColor,
  bodyColor,
  dateColumns
) {

  sheet.setHiddenGridlines(false);
  sheet.setFrozenRows(1);

  const lastRow = Math.max(sheet.getLastRow(), 1);

  // 移除舊篩選器
  const oldFilter = sheet.getFilter();

  if (oldFilter) {
    oldFilter.remove();
  }

  // 移除舊交錯色彩，避免重複套用
  sheet.getBandings().forEach(function (banding) {
    banding.remove();
  });

  // 標題列
  sheet.getRange(1, 1, 1, columnCount)
    .setBackground(headerColor)
    .setFontColor(UI_STYLE.WHITE)
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.setRowHeight(1, 32);

  // 資料區
  if (lastRow > 1) {

    sheet.getRange(2, 1, lastRow - 1, columnCount)
      .setBackground(bodyColor)
      .setFontColor(UI_STYLE.TEXT)
      .setVerticalAlignment("middle");

    sheet.getRange(1, 1, lastRow, columnCount)
      .createFilter();

    // 日期欄位格式
    dateColumns.forEach(function (column) {

      sheet.getRange(
        2,
        column,
        lastRow - 1,
        1
      ).setNumberFormat("yyyy/MM/dd HH:mm:ss");

    });

  }

  // 邊框
  sheet.getRange(1, 1, lastRow, columnCount)
    .setBorder(
      true,
      true,
      true,
      true,
      true,
      true,
      UI_STYLE.BORDER,
      SpreadsheetApp.BorderStyle.SOLID
    );

  // Code 欄位
  sheet.getRange(2, 1, Math.max(lastRow - 1, 1), 1)
    .setFontWeight("bold")
    .setHorizontalAlignment("left");

  // 自動調整欄寬
  sheet.autoResizeColumns(1, columnCount);

  // 避免 Code 欄太窄
  sheet.setColumnWidth(1, 155);

  for (let column = 2; column <= columnCount; column++) {
    if (sheet.getColumnWidth(column) < 145) {
      sheet.setColumnWidth(column, 145);
    }
  }

}

/**************************************************
 * Dashboard 條件格式
 **************************************************/

function applyDashboardConditionalFormatting() {

  const sheet = getSheet(CONFIG.SHEETS.DASHBOARD);

  if (!sheet) {
    return;
  }

  const rules = [];

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("正常")
      .setBackground(UI_STYLE.GREEN_LIGHT)
      .setFontColor(UI_STYLE.GREEN)
      .setBold(true)
      .setRanges([sheet.getRange("B9")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("失敗")
      .setBackground(UI_STYLE.RED_LIGHT)
      .setFontColor(UI_STYLE.RED)
      .setBold(true)
      .setRanges([sheet.getRange("B9")])
      .build()
  );

  rules.push(
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setBackground(UI_STYLE.AMBER_LIGHT)
      .setFontColor(UI_STYLE.AMBER)
      .setBold(true)
      .setRanges([sheet.getRange("B10:B13")])
      .build()
  );

  sheet.setConditionalFormatRules(rules);

}

/**************************************************
 * Dashboard 系統資訊卡片樣式
 *
 * 僅負責樣式，不寫入任何資料。
 **************************************************/
function styleSystemInfoCard_(sheet) {

  const CARD_RANGE = "F4:H10";
  const TITLE_RANGE = "F4:H4";
  const LABEL_RANGE = "F5:F10";
  const VALUE_RANGE = "G5:H10";

  sheet.getRange(CARD_RANGE).breakApart();
  sheet.getRange(CARD_RANGE).clearFormat();

  sheet.getRange(TITLE_RANGE).merge();

  for (let row = 5; row <= 10; row++) {
    sheet.getRange(row, 7, 1, 2).merge();
  }

  sheet.setColumnWidth(6, 85);
  sheet.setColumnWidth(7, 140);
  sheet.setColumnWidth(8, 40);

  sheet.getRange(CARD_RANGE)
    .setFontFamily("Arial")
    .setVerticalAlignment("middle");

  sheet.getRange(CARD_RANGE)
    .setBorder(
      true,
      true,
      true,
      true,
      false,
      false,
      UI_STYLE.BORDER,
      SpreadsheetApp.BorderStyle.SOLID
    );

  sheet.getRange(TITLE_RANGE)
    .setBackground(UI_STYLE.NAVY)
    .setFontColor(UI_STYLE.WHITE)
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center");

  sheet.getRange(LABEL_RANGE)
    .setBackground("#F3F6F9")
    .setFontColor(UI_STYLE.MUTED)
    .setFontWeight("bold")
    .setFontSize(10);

  sheet.getRange(VALUE_RANGE)
    .setBackground(UI_STYLE.WHITE)
    .setFontColor(UI_STYLE.TEXT)
    .setFontSize(10)
    .setHorizontalAlignment("left");

  sheet.getRange(LABEL_RANGE)
    .setBorder(
      false,
      false,
      false,
      true,
      false,
      false,
      "#E3E9EF",
      SpreadsheetApp.BorderStyle.SOLID
    );

  for (let row = 5; row <= 9; row++) {

    sheet.getRange(row, 6, 1, 3)
      .setBorder(
        false,
        false,
        true,
        false,
        false,
        false,
        "#E3E9EF",
        SpreadsheetApp.BorderStyle.SOLID
      );

  }

}
