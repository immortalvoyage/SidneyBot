/**************************************************
 * Update.gs
 **************************************************/

function updateAll() {

  const startTime = Date.now();

  try {

    createSheets();

    const api = getApiData();

    const active = Array.isArray(api.active)
      ? api.active
      : [];

    const expired = Array.isArray(api.expired)
      ? api.expired
      : [];

    const newCount = updateNewCodes(active);

    updateHistory(active, expired);
    updateActiveSheetData(active);
    updateExpiredSheetData(expired);

    const duration = Date.now() - startTime;

    updateDashboardData(
      active.length,
      expired.length,
      newCount,
      duration,
      "正常"
    );

    /**************************************************
     * 發送 Discord 新兌換碼通知
     **************************************************/

    try {

      // 只在本次確實有新增兌換碼時發送通知
      if (
        newCount > 0 &&
        Array.isArray(LAST_NEW_CODES)
      ) {

        sendDiscordNewCodes_(
          LAST_NEW_CODES,
          active.length,
          expired.length
        );

      }

    } catch (discordError) {

      // Discord 失敗不影響主要資料更新
      console.error(
        "Discord 通知發送失敗：",
        discordError
      );

    }

    /**************************************************
     * 寫入成功更新日誌
     **************************************************/

    writeLog(
      active.length,
      expired.length,
      newCount,
      duration,
      "成功"
    );

    // 最後固定 Dashboard 左側卡片框線
    const dashboard = getSheet(CONFIG.SHEETS.DASHBOARD);

    [
      [4, UI_STYLE.GREEN],
      [5, UI_STYLE.RED],
      [6, UI_STYLE.TEAL],
      [8, UI_STYLE.GREEN],
      [9, UI_STYLE.RED],
      [10, UI_STYLE.BLUE],
      [11, UI_STYLE.AMBER],
      [12, UI_STYLE.PURPLE],
      [13, UI_STYLE.TEAL],
      [14, UI_STYLE.AMBER]
    ].forEach(function (item) {

      const row = item[0];
      const color = item[1];

      dashboard.getRange(row, 1, 1, 2)
        .setBorder(
          true,
          true,
          true,
          true,
          false,
          false,
          color,
          SpreadsheetApp.BorderStyle.SOLID_MEDIUM
        );

    });

    SpreadsheetApp.flush();

    SpreadsheetApp.getActive().toast(
      "資料更新完成",
      CONFIG.APP.TOAST_TITLE,
      5
    );

  } catch (error) {

    const duration = Date.now() - startTime;

    updateDashboardError_(
      error,
      duration
    );

    /**************************************************
     * 寫入失敗更新日誌
     **************************************************/

    writeLog(
      0,
      0,
      0,
      duration,
      "失敗：" + (error.message || String(error))
    );

    throw error;

  }

}

/**************************************************
 * Active
 **************************************************/

function updateActiveSheetData(active) {

  Logger.log("===== updateActiveSheetData =====");
  Logger.log(typeof active);
  Logger.log(Array.isArray(active));
  Logger.log(active);

  if (!Array.isArray(active)) {
    throw new Error("active 不是 Array");
  }

  const sheet = SpreadsheetApp.getActive()
    .getSheetByName(CONFIG.SHEETS.ACTIVE);

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 3)
    .setValues([CONFIG.HEADER_ACTIVE]);

  if (active.length === 0) {
    return;
  }

  const rows = active.map(c => [
    c.code,
    c.addedAt,
    c.verifiedAt
  ]);

  sheet.getRange(2, 1, rows.length, 3).setValues(rows);

  sheet.setFrozenRows(1);

}

/**************************************************
 * Expired
 **************************************************/

function updateExpiredSheetData(expired) {

  const sheet = SpreadsheetApp.getActive()
    .getSheetByName(CONFIG.SHEETS.EXPIRED);

  sheet.clearContents();

  sheet.getRange(1, 1, 1, 4)
    .setValues([CONFIG.HEADER_EXPIRED]);

  if (expired.length === 0) return;

  const rows = expired.map(c => [
    c.code,
    c.addedAt,
    c.verifiedAt,
    c.expiredAt
  ]);

  sheet.getRange(2, 1, rows.length, 4).setValues(rows);

  sheet.setFrozenRows(1);

}


/**************************************************
 * 函式：updateDashboardError_
 *
 * 說明：此函式為系統模組的公開或內部處理程序。
 **************************************************/
function updateDashboardError_(error, duration) {

  try {

    const sheet = getSheet(CONFIG.SHEETS.DASHBOARD);

    if (!sheet) {
      return;
    }

    sheet.getRange("A8").setValue("最後更新");
    sheet.getRange("B8").setValue(new Date());

    sheet.getRange("A9").setValue("API 狀態");
    sheet.getRange("B9")
      .setValue("🔴 更新失敗");

    sheet.getRange("A10").setValue("錯誤訊息");
    sheet.getRange("B10")
      .setValue(error.message || String(error));

    sheet.getRange("A11").setValue("更新耗時");
    sheet.getRange("B11")
      .setValue(duration / 1000)
      .setNumberFormat('0.00 "秒"');

    styleDashboard();

  } catch (dashboardError) {

    console.error(
      "Dashboard 錯誤狀態更新失敗：",
      dashboardError
    );

  }

}
