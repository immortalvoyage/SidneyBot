/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Analytics.gs
 *
 * 統計規則：
 * 1. 今日新增：Verified 時間為今天
 * 2. 7 天新增：Verified 時間介於今天往前 6 天
 * 3. 30 天新增：Verified 時間介於今天往前 29 天
 * 4. 不再使用「新增兌換碼」工作表的發現日期
 **************************************************/

/**************************************************
 * 取得 Dashboard 統計資料
 *
 * @return {{
 *   today: number,
 *   last7Days: number,
 *   last30Days: number
 * }}
 **************************************************/
function getAnalytics() {

  // 取得目前試算表
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  // 取得可用兌換碼工作表
  const activeSheet = spreadsheet.getSheetByName(
    CONFIG.SHEETS.ACTIVE
  );

  // 預設統計結果
  const analytics = {
    today: 0,
    last7Days: 0,
    last30Days: 0
  };

  // 工作表不存在時直接回傳空統計
  if (!activeSheet) {
    return analytics;
  }

  // 取得工作表最後資料列
  const lastRow = activeSheet.getLastRow();

  // 只有標題列或完全沒有資料時直接回傳
  if (lastRow < 2) {
    return analytics;
  }

  /**************************************************
   * 尋找 Verified 欄位位置
   **************************************************/

  // 取得標題欄數
  const headerColumnCount = activeSheet.getLastColumn();

  // 讀取標題列
  const headers = activeSheet
    .getRange(1, 1, 1, headerColumnCount)
    .getDisplayValues()[0];

  // 尋找 Verified 欄位索引
  const verifiedColumnIndex = headers.findIndex(
    function (header) {
      return String(header)
        .trim()
        .toLowerCase() === "verified";
    }
  );

  // 找不到 Verified 欄位時直接回傳空統計
  if (verifiedColumnIndex === -1) {
    return analytics;
  }

  /**************************************************
   * 建立統計日期區間
   **************************************************/

  // 取得專案時區
  const timeZone =
    Session.getScriptTimeZone() ||
    "Asia/Taipei";

  // 目前時間
  const now = new Date();

  // 今日日期字串
  const todayKey = Utilities.formatDate(
    now,
    timeZone,
    "yyyy-MM-dd"
  );

  // 今日起始時間
  const todayStart = new Date(
    todayKey + "T00:00:00+08:00"
  );

  // 明日起始時間，作為今日區間上限
  const tomorrowStart = new Date(
    todayStart.getTime() +
    24 * 60 * 60 * 1000
  );

  // 最近 7 天起始時間，包含今天共 7 個日曆日
  const sevenDaysStart = new Date(
    todayStart.getTime() -
    6 * 24 * 60 * 60 * 1000
  );

  // 最近 30 天起始時間，包含今天共 30 個日曆日
  const thirtyDaysStart = new Date(
    todayStart.getTime() -
    29 * 24 * 60 * 60 * 1000
  );

  /**************************************************
   * 讀取 Verified 欄位
   **************************************************/

  // Google Sheets 欄位編號從 1 開始
  const verifiedColumnNumber =
    verifiedColumnIndex + 1;

  // 讀取所有 Verified 資料
  const verifiedValues = activeSheet
    .getRange(
      2,
      verifiedColumnNumber,
      lastRow - 1,
      1
    )
    .getValues();

  /**************************************************
   * 執行統計
   **************************************************/

  verifiedValues.forEach(function (row) {

    // 取得 Verified 原始值
    const rawVerified = row[0];

    // 空值不納入統計
    if (
      rawVerified === "" ||
      rawVerified === null ||
      rawVerified === undefined
    ) {
      return;
    }

    // 將值轉換成日期
    const verifiedDate =
      rawVerified instanceof Date
        ? rawVerified
        : new Date(rawVerified);

    // 無效日期不納入統計
    if (isNaN(verifiedDate.getTime())) {
      return;
    }

    // 排除未來時間
    if (verifiedDate >= tomorrowStart) {
      return;
    }

    // 今日新增
    if (
      verifiedDate >= todayStart &&
      verifiedDate < tomorrowStart
    ) {
      analytics.today++;
    }

    // 最近 7 天新增
    if (
      verifiedDate >= sevenDaysStart &&
      verifiedDate < tomorrowStart
    ) {
      analytics.last7Days++;
    }

    // 最近 30 天新增
    if (
      verifiedDate >= thirtyDaysStart &&
      verifiedDate < tomorrowStart
    ) {
      analytics.last30Days++;
    }

  });

  // 回傳統計結果
  return analytics;
}
