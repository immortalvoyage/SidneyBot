/**************************************************
 * WWM Redeem Code Tracker V2.0
 * DiscordReports.gs
 *
 * 職責：
 * 1. 清單分批
 * 2. 統計訊息
 * 3. 可用與失效清單
 * 4. 完整報告
 * 5. updateAll 自動通知
 **************************************************/

/**************************************************
 * 分批處理兌換碼
 *
 * @param {Array<string>} codes 兌換碼
 * @return {Array<Array<string>>}
 **************************************************/
function splitDiscordCodes_(codes) {

  const limits =
    CONFIG.DISCORD.LIMITS || {};

  const maxItems =
    Number(limits.ITEMS_PER_BATCH) || 40;

  const maxCharacters =
    Number(limits.DESCRIPTION_LENGTH) || 3500;

  const batches = [];

  let currentBatch = [];
  let currentLength = 0;

  (codes || []).forEach(function (code) {

    const estimatedLength =
      String(code || "").length + 15;

    if (
      currentBatch.length >= maxItems ||
      (
        currentBatch.length > 0 &&
        currentLength + estimatedLength >
          maxCharacters
      )
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentLength = 0;
    }

    currentBatch.push(code);
    currentLength += estimatedLength;
  });

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}


/**************************************************
 * 發送兌換碼清單
 *
 * @param {string} title 標題
 * @param {Array<string>} codes 兌換碼
 * @param {Array<Object>=} fields 欄位
 * @param {number=} color 顏色
 * @return {number} 訊息批次數
 **************************************************/
function sendDiscordCodeList_(
  title,
  codes,
  fields,
  color
) {

  const normalizedCodes =
    uniqueDiscordCodes_(codes);

  if (normalizedCodes.length === 0) {
    return 0;
  }

  const batches =
    splitDiscordCodes_(
      normalizedCodes
    );

  let globalIndex = 1;

  batches.forEach(function (
    batchCodes,
    batchIndex
  ) {

    const description =
      batchCodes
        .map(function (code) {

          const line =
            globalIndex +
            ". 🎁 `" +
            code +
            "`";

          globalIndex++;

          return line;
        })
        .join("\n");

    const batchTitle =
      batches.length > 1
        ? (
          title +
          "（" +
          (batchIndex + 1) +
          "/" +
          batches.length +
          "）"
        )
        : title;

    const embed =
      createDiscordEmbed_(
        batchTitle,
        description,
        batchIndex === 0
          ? fields
          : [],
        color
      );

    sendDiscordEmbed_(embed);

    if (batchIndex < batches.length - 1) {
      Utilities.sleep(
        getDiscordDelay_()
      );
    }
  });

  return batches.length;
}


/**************************************************
 * 測試 Discord
 **************************************************/
function testDiscordWebhook() {

  const embed =
    createDiscordEmbed_(
      "Discord 整合正常",
      "Sidney 已成功連接 Discord Webhook。\n後台管理員：凜冬皓月",
      [
        {
          name: "系統",
          value: getDiscordFooter_(),
          inline: true
        },
        {
          name: "狀態",
          value: "✅ 正常",
          inline: true
        }
      ],
      getDiscordColor_("TEST")
    );

  const statusCode =
    sendDiscordEmbed_(
      embed,
      "✅ " +
      CONFIG.APP.NAME +
      " Discord 連線測試成功"
    );

  showDiscordToast_(
    "Discord 發送成功｜HTTP " +
    statusCode,
    8
  );
}


/**************************************************
 * 傳送最後一次更新真正新增的兌換碼
 **************************************************/
function sendNewCodesToDiscord() {

  // 僅讀取 updateNewCodes() 保存的最後一次更新快照
  // 不重新掃描工作表，避免將歷史兌換碼再次傳送。
  const codes =
    getLatestNewCodes_();

  if (codes.length === 0) {
    showDiscordToast_(
      "上次更新沒有新增兌換碼",
      6
    );

    return;
  }

  const statistics =
    getDiscordStatistics_();

  sendDiscordCodeList_(
    "🆕 上次更新新增兌換碼",
    codes,
    [
      {
        name: "上次更新新增",
        value: String(codes.length),
        inline: true
      },
      {
        name: "目前可用",
        value: String(statistics.active),
        inline: true
      },
      {
        name: "已失效",
        value: String(statistics.expired),
        inline: true
      }
    ],
    getDiscordColor_("NEW")
  );

  showDiscordToast_(
    "已傳送 " +
    codes.length +
    " 個上次更新新增兌換碼",
    8
  );
}


/**************************************************
 * 傳送今日 API 加入兌換碼矩陣
 *
 * 規則：
 * 1. 讀取「新增兌換碼」工作表
 * 2. 使用 C 欄「API 加入時間」判斷
 * 3. 依專案時區篩選今日資料
 * 4. 每列排列 10 個兌換碼
 * 5. 超過 Discord 字數限制時自動分批
 **************************************************/
function sendTodayApiCodesMatrixToDiscord() {

  const codes =
    getTodayApiAddedCodes_();

  if (codes.length === 0) {
    showDiscordToast_(
      "今天沒有新增兌換碼",
      6
    );

    return;
  }

  const timeZone =
    Session.getScriptTimeZone() ||
    "Asia/Taipei";

  const todayText =
    Utilities.formatDate(
      new Date(),
      timeZone,
      "yyyy/MM/dd"
    );

  const matrixParts =
    createDiscordCodeMatrixParts_(
      codes,
      10,
      3500
    );

  matrixParts.forEach(function (
    matrixText,
    partIndex
  ) {

    const title =
      matrixParts.length > 1
        ? "🧩 今日新增兌換碼（" +
          (partIndex + 1) +
          "/" +
          matrixParts.length +
          "）"
        : "🧩 今日新增兌換碼";

    const fields =
      partIndex === 0
        ? [
          {
            name: "新增日期",
            value: todayText,
            inline: true
          },
          {
            name: "今日總數",
            value: String(codes.length),
            inline: true
          },
          {
            name: "排列方式",
            value: "每列 10 個",
            inline: true
          }
        ]
        : [];

    const embed =
      createDiscordEmbed_(
        title,
        "```text\n" +
        matrixText +
        "\n```",
        fields,
        getDiscordColor_("NEW")
      );

    sendDiscordEmbed_(embed);

    if (
      partIndex <
      matrixParts.length - 1
    ) {
      Utilities.sleep(
        getDiscordDelay_()
      );
    }
  });

  showDiscordToast_(
    "已傳送今日 API 新增矩陣｜共 " +
    codes.length +
    " 個",
    8
  );
}


/**************************************************
 * 取得今日 API 加入的所有兌換碼
 *
 * 「新增兌換碼」工作表欄位：
 * A：發現日期
 * B：兌換碼
 * C：API 加入時間
 * D：首次發現時間
 * E：更新批次
 *
 * @return {Array<string>} 今日 API 加入兌換碼
 **************************************************/
function getTodayApiAddedCodes_() {

  const sheet =
    getDiscordSheet_(
      CONFIG.SHEETS.NEW
    );

  const lastRow =
    sheet.getLastRow();

  if (lastRow <= 1) {
    return [];
  }

  const timeZone =
    Session.getScriptTimeZone() ||
    "Asia/Taipei";

  const todayKey =
    Utilities.formatDate(
      new Date(),
      timeZone,
      "yyyy-MM-dd"
    );

  const values =
    sheet
      .getRange(
        2,
        2,
        lastRow - 1,
        2
      )
      .getValues();

  const todayCodes =
    values
      .filter(function (row) {

        const code =
          String(row[0] || "")
            .trim();

        const apiAddedDate =
          parseDiscordDate_(
            row[1]
          );

        if (
          !code ||
          !apiAddedDate
        ) {
          return false;
        }

        const apiDateKey =
          Utilities.formatDate(
            apiAddedDate,
            timeZone,
            "yyyy-MM-dd"
          );

        return apiDateKey === todayKey;
      })
      .map(function (row) {
        return row[0];
      });

  return uniqueDiscordCodes_(
    todayCodes
  );
}


/**************************************************
 * 建立 Discord 兌換碼矩陣分批內容
 *
 * @param {Array<string>} codes 兌換碼
 * @param {number} columns 每列欄數
 * @param {number} maxCharacters 每批最大字數
 * @return {Array<string>} 矩陣文字批次
 **************************************************/
function createDiscordCodeMatrixParts_(
  codes,
  columns,
  maxCharacters
) {

  const normalizedCodes =
    uniqueDiscordCodes_(codes);

  const columnCount =
    Math.max(
      Number(columns) || 10,
      1
    );

  const characterLimit =
    Math.max(
      Number(maxCharacters) || 3500,
      500
    );

  const maximumCodeLength =
    normalizedCodes.reduce(
      function (maximum, code) {
        return Math.max(
          maximum,
          String(code).length
        );
      },
      1
    );

  const rows = [];

  for (
    let index = 0;
    index < normalizedCodes.length;
    index += columnCount
  ) {

    const rowCodes =
      normalizedCodes.slice(
        index,
        index + columnCount
      );

    const rowText =
      rowCodes
        .map(function (code) {
          return padDiscordMatrixCode_(
            String(code),
            maximumCodeLength
          );
        })
        .join("  ")
        .replace(/\s+$/, "");

    rows.push(rowText);
  }

  const parts = [];
  let currentRows = [];
  let currentLength = 0;

  rows.forEach(function (rowText) {

    const rowLength =
      rowText.length + 1;

    if (
      currentRows.length > 0 &&
      currentLength + rowLength >
      characterLimit
    ) {
      parts.push(
        currentRows.join("\n")
      );

      currentRows = [];
      currentLength = 0;
    }

    currentRows.push(rowText);
    currentLength += rowLength;
  });

  if (currentRows.length > 0) {
    parts.push(
      currentRows.join("\n")
    );
  }

  return parts;
}


/**************************************************
 * 補齊矩陣欄位寬度
 *
 * @param {string} code 兌換碼
 * @param {number} width 欄位寬度
 * @return {string}
 **************************************************/
function padDiscordMatrixCode_(
  code,
  width
) {

  const value =
    String(code || "");

  const paddingLength =
    Math.max(
      Number(width) - value.length,
      0
    );

  return value +
    new Array(
      paddingLength + 1
    ).join(" ");
}


/**************************************************
 * 傳送所有可用兌換碼 TXT 附件
 *
 * Discord 訊息只顯示摘要，完整兌換碼放在 TXT 附件。
 * 每個兌換碼獨立一行並附帶編號。
 **************************************************/
function sendAllActiveCodesToDiscord() {

  const codes =
    uniqueDiscordCodes_(
      getAllActiveCodes_()
    );

  if (codes.length === 0) {
    showDiscordToast_(
      "目前沒有可用兌換碼",
      6
    );

    return;
  }

  const timeZone =
    Session.getScriptTimeZone() ||
    "Asia/Taipei";

  const now = new Date();

  const displayTime =
    Utilities.formatDate(
      now,
      timeZone,
      "yyyy/MM/dd HH:mm:ss"
    );

  const fileTime =
    Utilities.formatDate(
      now,
      timeZone,
      "yyyyMMdd_HHmmss"
    );

  const fileName =
    "WWM_Active_Redeem_Codes_" +
    fileTime +
    ".txt";

  const textContent =
    createActiveCodesTxt_(
      codes,
      displayTime
    );

  const fileBlob =
    Utilities.newBlob(
      "\uFEFF" + textContent,
      "text/plain; charset=utf-8",
      fileName
    );

  const embed =
    createDiscordEmbed_(
      "📄 所有可用兌換碼",
      "完整清單已整理為 TXT 附件。",
      [
        {
          name: "目前可用總數",
          value: String(codes.length),
          inline: true
        },
        {
          name: "檔案格式",
          value: "TXT（UTF-8）",
          inline: true
        },
        {
          name: "更新時間",
          value: displayTime,
          inline: false
        }
      ],
      getDiscordColor_("ACTIVE")
    );

  sendDiscordFile_(
    fileBlob,
    embed
  );

  showDiscordToast_(
    "已傳送可用兌換碼 TXT｜共 " +
    codes.length +
    " 個",
    8
  );
}


/**************************************************
 * 傳送所有可用兌換碼 CSV 附件
 *
 * CSV 可直接使用 Excel 或 Google 試算表開啟。
 **************************************************/
function sendAllActiveCodesCsvToDiscord() {

  const codes =
    uniqueDiscordCodes_(
      getAllActiveCodes_()
    );

  if (codes.length === 0) {
    showDiscordToast_(
      "目前沒有可用兌換碼",
      6
    );

    return;
  }

  const timeZone =
    Session.getScriptTimeZone() ||
    "Asia/Taipei";

  const now = new Date();

  const displayTime =
    Utilities.formatDate(
      now,
      timeZone,
      "yyyy/MM/dd HH:mm:ss"
    );

  const fileTime =
    Utilities.formatDate(
      now,
      timeZone,
      "yyyyMMdd_HHmmss"
    );

  const fileName =
    "WWM_Active_Redeem_Codes_" +
    fileTime +
    ".csv";

  const csvContent =
    createActiveCodesCsv_(
      codes,
      displayTime
    );

  const fileBlob =
    Utilities.newBlob(
      "\uFEFF" + csvContent,
      "text/csv; charset=utf-8",
      fileName
    );

  const embed =
    createDiscordEmbed_(
      "📊 可用兌換碼 CSV",
      "完整清單已整理為 CSV 附件，可直接使用 Excel 開啟。",
      [
        {
          name: "目前可用總數",
          value: String(codes.length),
          inline: true
        },
        {
          name: "檔案格式",
          value: "CSV（UTF-8）",
          inline: true
        },
        {
          name: "更新時間",
          value: displayTime,
          inline: false
        }
      ],
      getDiscordColor_("ACTIVE")
    );

  sendDiscordFile_(
    fileBlob,
    embed
  );

  showDiscordToast_(
    "已傳送可用兌換碼 CSV｜共 " +
    codes.length +
    " 個",
    8
  );
}


/**************************************************
 * 建立可用兌換碼 TXT 內容
 *
 * @param {Array<string>} codes 可用兌換碼
 * @param {string} displayTime 更新時間
 * @return {string} TXT 文字內容
 **************************************************/
function createActiveCodesTxt_(
  codes,
  displayTime
) {

  const lines = [
    "========================================",
    "WWM Redeem Code Tracker",
    "所有可用兌換碼",
    "========================================",
    "更新時間：" + displayTime,
    "可用總數：" + codes.length,
    "========================================",
    ""
  ];

  codes.forEach(function (code, index) {
    lines.push(
      (index + 1) + ". " + code
    );
  });

  lines.push("");
  lines.push("========================================");
  lines.push(getDiscordFooter_());

  return lines.join("\r\n");
}


/**************************************************
 * 建立可用兌換碼 CSV 內容
 *
 * @param {Array<string>} codes 可用兌換碼
 * @param {string} displayTime 更新時間
 * @return {string} CSV 文字內容
 **************************************************/
function createActiveCodesCsv_(
  codes,
  displayTime
) {

  const rows = [
    ["序號", "兌換碼", "匯出時間"]
  ];

  codes.forEach(function (code, index) {
    rows.push([
      index + 1,
      code,
      displayTime
    ]);
  });

  return rows
    .map(function (row) {
      return row
        .map(function (value) {
          return escapeDiscordCsvValue_(value);
        })
        .join(",");
    })
    .join("\r\n");
}


/**************************************************
 * 安全處理 CSV 欄位值
 *
 * @param {*} value 原始值
 * @return {string} CSV 安全值
 **************************************************/
function escapeDiscordCsvValue_(value) {

  const text =
    String(
      value === null ||
      value === undefined
        ? ""
        : value
    );

  return (
    '"' +
    text.replace(/"/g, '""') +
    '"'
  );
}


/**************************************************
 * 傳送所有已失效兌換碼
 **************************************************/
function sendExpiredCodesToDiscord() {

  const codes =
    getAllExpiredCodes_();

  if (codes.length === 0) {
    showDiscordToast_(
      "目前沒有已失效兌換碼",
      6
    );

    return;
  }

  sendDiscordCodeList_(
    "📉 所有已失效兌換碼",
    codes,
    [
      {
        name: "已失效總數",
        value: String(codes.length),
        inline: true
      }
    ],
    getDiscordColor_("EXPIRED")
  );

  showDiscordToast_(
    "已傳送 " +
    codes.length +
    " 個已失效兌換碼",
    8
  );
}


/**************************************************
 * 傳送統計資訊
 **************************************************/
function sendStatisticsToDiscord() {

  const statistics =
    getDiscordStatistics_();

  const embed =
    createDiscordEmbed_(
      "📊 兌換碼統計資訊",
      "目前兌換碼資料庫統計如下：",
      createDiscordStatisticsFields_(
        statistics
      ),
      getDiscordColor_("STATISTICS")
    );

  sendDiscordEmbed_(embed);

  showDiscordToast_(
    "Discord 統計資訊已傳送",
    8
  );
}


/**************************************************
 * 傳送完整報告
 **************************************************/
function sendFullReportToDiscord() {

  const statistics =
    getDiscordStatistics_();

  const newCodes =
    getLatestNewCodes_();

  const activeCodes =
    getAllActiveCodes_();

  const expiredCodes =
    getAllExpiredCodes_();

  const summaryEmbed =
    createDiscordEmbed_(
      "📜 兌換碼完整報告",
      "以下為目前兌換碼監控系統完整資料。",
      createDiscordStatisticsFields_(
        statistics
      ),
      getDiscordColor_("REPORT")
    );

  sendDiscordEmbed_(summaryEmbed);

  if (newCodes.length > 0) {
    Utilities.sleep(getDiscordDelay_());

    sendDiscordCodeList_(
      "🆕 上次更新新增兌換碼",
      newCodes,
      [],
      getDiscordColor_("NEW")
    );
  }

  if (activeCodes.length > 0) {
    Utilities.sleep(getDiscordDelay_());

    // 完整報告中的可用兌換碼同樣使用 TXT 附件，
    // 避免大量 Embed 分批造成洗版。
    const timeZone =
      Session.getScriptTimeZone() ||
      "Asia/Taipei";

    const now = new Date();

    const displayTime =
      Utilities.formatDate(
        now,
        timeZone,
        "yyyy/MM/dd HH:mm:ss"
      );

    const fileTime =
      Utilities.formatDate(
        now,
        timeZone,
        "yyyyMMdd_HHmmss"
      );

    const fileBlob =
      Utilities.newBlob(
        "\uFEFF" +
        createActiveCodesTxt_(
          uniqueDiscordCodes_(activeCodes),
          displayTime
        ),
        "text/plain; charset=utf-8",
        "WWM_Active_Redeem_Codes_" +
        fileTime +
        ".txt"
      );

    const activeEmbed =
      createDiscordEmbed_(
        "📄 所有可用兌換碼",
        "完整清單已整理為 TXT 附件。",
        [
          {
            name: "目前可用總數",
            value: String(activeCodes.length),
            inline: true
          }
        ],
        getDiscordColor_("ACTIVE")
      );

    sendDiscordFile_(
      fileBlob,
      activeEmbed
    );
  }

  if (expiredCodes.length > 0) {
    Utilities.sleep(getDiscordDelay_());

    sendDiscordCodeList_(
      "📉 所有已失效兌換碼",
      expiredCodes,
      [],
      getDiscordColor_("EXPIRED")
    );
  }

  showDiscordToast_(
    "Discord 完整報告已傳送",
    8
  );
}


/**************************************************
 * updateAll 自動新增通知相容函式
 *
 * 請勿重新命名。
 *
 * @param {Array<Object|string>} newCodes 新增資料
 * @param {number} activeCount 可用數量
 * @param {number} expiredCount 已失效數量
 **************************************************/
function sendDiscordNewCodes_(
  newCodes,
  activeCount,
  expiredCount
) {

  if (
    !CONFIG.DISCORD ||
    CONFIG.DISCORD.ENABLED !== true ||
    !Array.isArray(newCodes) ||
    newCodes.length === 0
  ) {
    return;
  }

  const normalizedCodes =
    uniqueDiscordCodes_(
      newCodes.map(function (item) {

        if (
          item &&
          typeof item === "object"
        ) {
          return (
            item.code ||
            item.Code ||
            item.redeemCode ||
            ""
          );
        }

        return item;
      })
    );

  if (normalizedCodes.length === 0) {
    return;
  }

  sendDiscordCodeList_(
    "🆕 發現新的兌換碼",
    normalizedCodes,
    [
      {
        name: "目前可用",
        value: String(
          Number(activeCount) || 0
        ),
        inline: true
      },
      {
        name: "已失效",
        value: String(
          Number(expiredCount) || 0
        ),
        inline: true
      },
      {
        name: "本次新增",
        value: String(
          normalizedCodes.length
        ),
        inline: true
      }
    ],
    getDiscordColor_("NEW")
  );
}
