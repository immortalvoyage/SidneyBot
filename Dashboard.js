/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Dashboard.gs
 **************************************************/

/**
 * 更新 Dashboard
 *
 * @param {number} activeCount 目前可用數量
 * @param {number} expiredCount 已失效數量
 * @param {number} newCount 本次新增數量
 * @param {number} duration 更新耗時，毫秒
 * @param {string} apiStatus API 狀態，可省略
 */
function updateDashboardData(
  activeCount,
  expiredCount,
  newCount,
  duration,
  apiStatus
) {

  const sheet = getSheet(CONFIG.SHEETS.DASHBOARD);

  if (!sheet) {
    throw new Error("找不到 Dashboard 工作表");
  }

  activeCount = Number(activeCount) || 0;
  expiredCount = Number(expiredCount) || 0;
  newCount = Number(newCount) || 0;
  duration = Number(duration) || 0;
  apiStatus = apiStatus || "正常";

  // 依照 Verified 時間取得今日、7 天、30 天統計
  const analytics = getAnalytics();

  // 清除舊的統計與最近新增殘留資料
  sheet.getRange("A9:D15").clearContent();
  sheet.getRange("A17:D21").clearContent();

  /**************************************************
   * 標題
   **************************************************/

  sheet.getRange("A1:H1").breakApart();
  sheet.getRange("A1:H1").merge();

  sheet.getRange("A1")
    .setValue(getAppName());

  sheet.getRange("A2:H2").breakApart();

  sheet.getRange("A2:B2").merge();
  sheet.getRange("A2:B2")
    .setValue("兌換碼助手");

  sheet.getRange("C2:H2").merge();
  sheet.getRange("C2:H2")
    .setValue(getAppAuthor());

  /**************************************************
   * 統計資料
   **************************************************/

  sheet.getRange("A4").setValue("目前可用");
  sheet.getRange("B4").setValue(activeCount);

  sheet.getRange("A5").setValue("已失效");
  sheet.getRange("B5").setValue(expiredCount);

  sheet.getRange("A6").setValue("總數");
  sheet.getRange("B6")
    .setValue(activeCount + expiredCount);

  sheet.getRange("A8").setValue("最後更新");
  sheet.getRange("B8").setValue(new Date());

  /**************************************************
   * 系統狀態與新增統計
   **************************************************/

  const api = getApiStatus();

  sheet.getRange("A9").setValue("API 狀態");

  sheet.getRange("B9").setValue(
    api.isHealthy
      ? "🟢 正常"
      : "🔴 " + api.status
  );

  sheet.getRange("A10").setValue("本次新增");
  sheet.getRange("B10").setValue(newCount);

  // 今日 Verified 數量
  sheet.getRange("A11").setValue("今日新增");
  sheet.getRange("B11").setValue(
    Number(analytics.today) || 0
  );

  /**************************************************
   * Verified 時間統計
   **************************************************/

  // 最近 7 個日曆日的 Verified 數量
  sheet.getRange("A12").setValue("7天新增");
  sheet.getRange("B12").setValue(
    Number(analytics.last7Days) || 0
  );

  // 最近 30 個日曆日的 Verified 數量
  sheet.getRange("A13").setValue("30天新增");
  sheet.getRange("B13").setValue(
    Number(analytics.last30Days) || 0
  );

  sheet.getRange("A14").setValue("API 耗時");

  sheet.getRange("B14")
    .setValue(
      getApiStatus().durationMs / 1000
    )
    .setNumberFormat('0.00 "秒"');

  /**************************************************
   * 系統資訊
   **************************************************/

  sheet.getRange("F4:H4").breakApart();
  sheet.getRange("F4:H4").merge();

  sheet.getRange("F4")
    .setValue("系統資訊");

  sheet.getRange("F5").setValue("版本");

  sheet
    .getRange("G5")
    .setValue(getAppVersion());

  sheet.getRange("F6").setValue("資料來源");
  sheet.getRange("G6").setValue("codes.yar.gg");

  sheet.getRange("F7").setValue("更新方式");
  sheet.getRange("G7").setValue("Google Apps Script");

  sheet.getRange("F8").setValue("HTTP");

  sheet.getRange("G8").setValue(
    getApiStatus().httpCode
  );

  sheet.getRange("F9").setValue("API 更新");

  sheet.getRange("G9").setValue(
    getApiStatus().updateTime
  );

  sheet.getRange("F10").setValue("API 錯誤");

  sheet.getRange("G10").setValue(
    getApiStatus().error || "-"
  );

  /**************************************************
   * 最近新增兌換碼
   **************************************************/

  loadLatestNewCodes(sheet);

  /**************************************************
   * 重新套用 Dashboard 樣式
   **************************************************/

  styleDashboard();

}


/**************************************************
 * 載入最近新增的 5 組兌換碼
 **************************************************/

/**************************************************
 * 載入最近新增的 5 組兌換碼
 **************************************************/

function loadLatestNewCodes(dashboardSheet) {

  const newSheet = getSheet(CONFIG.SHEETS.NEW);

  // 解除舊合併，避免重新執行時發生衝突
  dashboardSheet.getRange("A17:D21").breakApart();

  // 清除舊內容
  dashboardSheet.getRange("A17:D21").clearContent();

  if (!newSheet) {
    dashboardSheet.getRange("A17:D17")
      .merge()
      .setValue("找不到新增兌換碼工作表");
    return;
  }

  const lastRow = newSheet.getLastRow();
  const lastColumn = newSheet.getLastColumn();

  if (lastRow <= 1 || lastColumn < 1) {
    dashboardSheet.getRange("A17:D17")
      .merge()
      .setValue("目前沒有新增兌換碼");
    return;
  }

  // 讀取標題列
  const headers = newSheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function (header) {
      return String(header).trim();
    });

  // 自動尋找欄位
  const codeColumnIndex = findHeaderIndex_(
    headers,
    [
      "兌換碼",
      "新增兌換碼",
      "可用兌換碼",
      "code",
      "redeem code"
    ]
  );

  const dateColumnIndex = findHeaderIndex_(
    headers,
    [
      "發現時間",
      "新增時間",
      "首次發現",
      "建立時間",
      "更新時間",
      "addedat",
      "added at",
      "date",
      "日期"
    ]
  );

  if (codeColumnIndex === -1) {
    dashboardSheet.getRange("A17:D17")
      .merge()
      .setValue("找不到兌換碼欄位，請檢查新增兌換碼標題列");
    return;
  }

  const data = newSheet
    .getRange(
      2,
      1,
      lastRow - 1,
      lastColumn
    )
    .getValues();

  const latestCodes = data
    .filter(function (row) {
      return String(row[codeColumnIndex] || "").trim() !== "";
    })
    .reverse()
    .slice(0, 5);

  latestCodes.forEach(function (row, index) {

    const targetRow = 17 + index;
    const code = String(row[codeColumnIndex] || "").trim();

    let foundTime = null;

    if (dateColumnIndex !== -1) {
      foundTime = row[dateColumnIndex];
    }

    // 左側顯示兌換碼
    dashboardSheet
      .getRange(targetRow, 1, 1, 2)
      .merge()
      .setValue(code)
      .setNumberFormat("@");

    // 右側顯示日期時間
    dashboardSheet
      .getRange(targetRow, 3, 1, 2)
      .merge();

    if (foundTime) {

      const dateValue = normalizeDate_(foundTime);

      if (dateValue) {
        dashboardSheet
          .getRange(targetRow, 3)
          .setValue(dateValue)
          .setNumberFormat("yyyy/MM/dd HH:mm:ss");
      } else {
        dashboardSheet
          .getRange(targetRow, 3)
          .setValue(String(foundTime));
      }

    }

  });

}


/**************************************************
 * 依標題名稱尋找欄位索引
 **************************************************/

function findHeaderIndex_(headers, candidates) {

  const normalizedHeaders = headers.map(function (header) {
    return String(header)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  });

  for (let i = 0; i < candidates.length; i++) {

    const candidate = String(candidates[i])
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");

    const exactIndex = normalizedHeaders.indexOf(candidate);

    if (exactIndex !== -1) {
      return exactIndex;
    }

  }

  // 找不到完全相同時，改用部分比對
  for (let column = 0; column < normalizedHeaders.length; column++) {

    for (let i = 0; i < candidates.length; i++) {

      const candidate = String(candidates[i])
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

      if (
        normalizedHeaders[column].includes(candidate) ||
        candidate.includes(normalizedHeaders[column])
      ) {
        return column;
      }

    }

  }

  return -1;

}


/**************************************************
 * 將資料轉成有效日期
 **************************************************/

function normalizeDate_(value) {

  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {

    const parsedDate = new Date(value);

    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }

  }

  return null;

}
