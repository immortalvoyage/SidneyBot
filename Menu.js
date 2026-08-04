/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Menu.gs
 *
 * 功能：
 * 建立 Google Sheets 企業版自訂選單
 **************************************************/

function onOpen() {

  const ui =
    SpreadsheetApp.getUi();

  /**************************************************
   * Discord 通知中心
   **************************************************/
  const discordMenu = ui
    .createMenu("📡 Discord")

    .addItem(
      "🆕 傳送上次更新新增兌換碼",
      "sendNewCodesToDiscord"
    )

    .addItem(
      "🧩 傳送今日新增兌換碼（矩陣）",
      "sendTodayApiCodesMatrixToDiscord"
    )

    .addItem(
      "📄 傳送所有可用兌換碼 TXT",
      "sendAllActiveCodesToDiscord"
    )

    .addItem(
      "📊 傳送所有可用兌換碼 CSV",
      "sendAllActiveCodesCsvToDiscord"
    )

    .addItem(
      "📉 傳送已失效兌換碼",
      "sendExpiredCodesToDiscord"
    )

    .addSeparator()

    .addItem(
      "📊 傳送統計資訊",
      "sendStatisticsToDiscord"
    )

    .addItem(
      "📜 傳送完整報告",
      "sendFullReportToDiscord"
    )

    .addSeparator()

    .addItem(
      "🧪 測試 Discord",
      "testDiscordWebhook"
    );

  /**************************************************
   * 工具
   **************************************************/
  const toolsMenu = ui
    .createMenu("🛠 工具")

    .addItem(
      "📋 複製全部兌換碼",
      "copyCodes"
    )

    .addItem(
      "📄 匯出 CSV",
      "exportCSV"
    );

  /**************************************************
   * 自動更新
   **************************************************/
  const triggerMenu = ui
    .createMenu("⚙ 自動更新")

    .addItem(
      "⏰ 建立每小時自動更新",
      "createHourlyTrigger"
    )

    .addItem(
      "❌ 移除所有自動更新",
      "deleteTriggers"
    );

  /**************************************************
   * 主選單
   **************************************************/
  ui
    .createMenu("🎮 燕雲助手")

    .addItem(
      "🔄 更新全部",
      "updateAll"
    )

    .addSeparator()

    .addSubMenu(discordMenu)

    .addSubMenu(toolsMenu)

    .addSubMenu(triggerMenu)

    .addToUi();
}
