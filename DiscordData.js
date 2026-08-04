/**************************************************
 * WWM Redeem Code Tracker V2.0
 * DiscordData.gs
 *
 * 職責：
 * 1. 讀取兌換碼工作表
 * 2. 清理與去除重複資料
 * 3. 計算 Discord 統計資料
 **************************************************/

/**************************************************
 * 取得工作表
 *
 * @param {string} sheetName 工作表名稱
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 **************************************************/
function getDiscordSheet_(sheetName) {

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(
      "找不到工作表：" + sheetName
    );
  }

  return sheet;
}


/**************************************************
 * 讀取指定欄位兌換碼
 *
 * @param {string} sheetName 工作表名稱
 * @param {number} columnNumber 欄位編號
 * @return {Array<string>}
 **************************************************/
function getDiscordCodesFromColumn_(
  sheetName,
  columnNumber
) {

  const sheet =
    getDiscordSheet_(sheetName);

  const lastRow =
    sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const values = sheet
    .getRange(
      2,
      columnNumber,
      lastRow - 1,
      1
    )
    .getDisplayValues();

  return uniqueDiscordCodes_(
    values.map(function (row) {
      return row[0];
    })
  );
}


/**************************************************
 * 取得所有可用兌換碼
 *
 * @return {Array<string>}
 **************************************************/
function getAllActiveCodes_() {

  return getDiscordCodesFromColumn_(
    CONFIG.SHEETS.ACTIVE,
    1
  );
}


/**************************************************
 * 取得所有已失效兌換碼
 *
 * @return {Array<string>}
 **************************************************/
function getAllExpiredCodes_() {

  return getDiscordCodesFromColumn_(
    CONFIG.SHEETS.EXPIRED,
    1
  );
}


/**************************************************
 * 取得最後一次更新真正新增的兌換碼
 *
 * 資料來源：
 * updateNewCodes() 儲存的 Script Properties 快照。
 *
 * 此函式保留原名稱供既有模組相容，但不再掃描
 * 「新增兌換碼」工作表的日期或最新批次。
 *
 * @return {Array<string>} 最後一次更新新增兌換碼
 **************************************************/
function getLatestNewCodes_() {

  return uniqueDiscordCodes_(
    getLastNewCodesSnapshot_()
      .map(function (item) {
        return item.code;
      })
  );

}


/**************************************************
 * 清理並去除重複兌換碼
 *
 * @param {Array<*>} codes 原始資料
 * @return {Array<string>}
 **************************************************/
function uniqueDiscordCodes_(codes) {

  const seen = {};

  return (codes || [])
    .map(function (code) {
      return String(code || "").trim();
    })
    .filter(function (code) {

      if (!code) {
        return false;
      }

      const normalized =
        code.toUpperCase();

      if (seen[normalized]) {
        return false;
      }

      seen[normalized] = true;

      return true;
    });
}


/**************************************************
 * 取得 Discord 統計資料
 *
 * @return {Object}
 **************************************************/
function getDiscordStatistics_() {

  const activeCodes =
    getAllActiveCodes_();

  const expiredCodes =
    getAllExpiredCodes_();

  const latestNewCodes =
    getLatestNewCodes_();

  const apiStatus =
    getApiStatus();

  const statistics = {
    active: activeCodes.length,

    expired: expiredCodes.length,

    total:
      activeCodes.length +
      expiredCodes.length,

    currentNew:
      latestNewCodes.length,

    today: 0,

    last7Days: 0,

    last30Days: 0,

    lastUpdate:
      getDiscordLastUpdate_(),

    apiStatus:
      apiStatus.status,

    apiHttpCode:
      apiStatus.httpCode,

    apiDurationMs:
      apiStatus.durationMs,

    apiUpdateTime:
      apiStatus.updateTime,

    apiError:
      apiStatus.error,

    apiHealthy:
      apiStatus.isHealthy
  };

  const sheet =
    getDiscordSheet_(
      CONFIG.SHEETS.ACTIVE
    );

  if (sheet.getLastRow() <= 1) {
    return statistics;
  }

  const headers = sheet
    .getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    )
    .getDisplayValues()[0];

  const verifiedIndex =
    headers.findIndex(function (header) {
      return (
        String(header || "")
          .trim()
          .toLowerCase() ===
        "verified"
      );
    });

  if (verifiedIndex < 0) {
    return statistics;
  }

  const values = sheet
    .getRange(
      2,
      verifiedIndex + 1,
      sheet.getLastRow() - 1,
      1
    )
    .getValues();

  const now = new Date();

  const todayStart =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

  const tomorrowStart =
    new Date(todayStart);

  tomorrowStart.setDate(
    tomorrowStart.getDate() + 1
  );

  const last7DaysStart =
    new Date(todayStart);

  last7DaysStart.setDate(
    last7DaysStart.getDate() - 6
  );

  const last30DaysStart =
    new Date(todayStart);

  last30DaysStart.setDate(
    last30DaysStart.getDate() - 29
  );

  values.forEach(function (row) {

    const verifiedDate =
      parseDiscordDate_(row[0]);

    if (!verifiedDate) {
      return;
    }

    if (
      verifiedDate >= todayStart &&
      verifiedDate < tomorrowStart
    ) {
      statistics.today++;
    }

    if (
      verifiedDate >= last7DaysStart &&
      verifiedDate < tomorrowStart
    ) {
      statistics.last7Days++;
    }

    if (
      verifiedDate >= last30DaysStart &&
      verifiedDate < tomorrowStart
    ) {
      statistics.last30Days++;
    }
  });

  return statistics;
}


/**************************************************
 * 解析日期
 *
 * @param {*} value 日期值
 * @return {Date|null}
 **************************************************/
function parseDiscordDate_(value) {

  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return null;
  }

  const parsedDate =
    new Date(value);

  return isNaN(parsedDate.getTime())
    ? null
    : parsedDate;
}


/**************************************************
 * 取得最後更新時間
 *
 * @return {string}
 **************************************************/
function getDiscordLastUpdate_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  let logSheet =
    spreadsheet.getSheetByName(
      CONFIG.SHEETS.LOG
    );

  if (!logSheet) {
    logSheet =
      spreadsheet.getSheetByName(
        "更新日誌"
      );
  }

  if (
    !logSheet ||
    logSheet.getLastRow() <= 1
  ) {
    return "無更新紀錄";
  }

  return (
    logSheet
      .getRange(
        logSheet.getLastRow(),
        1
      )
      .getDisplayValue() ||
    "無更新紀錄"
  );
}


/**************************************************
 * 建立 Discord 統計欄位
 *
 * @param {Object} statistics 統計資料
 * @return {Array<Object>}
 **************************************************/
function createDiscordStatisticsFields_(
  statistics
) {

  const apiStatusText =
    statistics.apiHealthy
      ? "🟢 正常"
      : "🔴 " +
      String(
        statistics.apiStatus ||
        "異常"
      );

  const httpCodeText =
    Number(statistics.apiHttpCode) > 0
      ? String(statistics.apiHttpCode)
      : "無";

  return [
    {
      name: "🎁 目前可用",
      value: String(statistics.active),
      inline: true
    },
    {
      name: "❌ 已失效",
      value: String(statistics.expired),
      inline: true
    },
    {
      name: "📦 總數",
      value: String(statistics.total),
      inline: true
    },
    {
      name: "🆕 本次新增",
      value: String(statistics.currentNew),
      inline: true
    },
    {
      name: "📅 今日 Verified",
      value: String(statistics.today),
      inline: true
    },
    {
      name: "📆 最近 7 天",
      value: String(statistics.last7Days),
      inline: true
    },
    {
      name: "🗓️ 最近 30 天",
      value: String(statistics.last30Days),
      inline: true
    },
    {
      name: "🌐 API 狀態",
      value: apiStatusText,
      inline: true
    },
    {
      name: "🔢 HTTP 狀態",
      value: httpCodeText,
      inline: true
    },
    {
      name: "⚡ API 耗時",
      value:
        String(
          Number(
            statistics.apiDurationMs
          ) || 0
        ) +
        " ms",
      inline: true
    },
    {
      name: "🕒 最後更新",
      value:
        String(
          statistics.lastUpdate
        ),
      inline: false
    }
  ];
}
