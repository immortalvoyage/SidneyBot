/**************************************************
 * WWM Redeem Code Tracker V2.0
 * DiscordCore.gs
 *
 * 職責：
 * 1. Discord Webhook 管理
 * 2. Discord HTTP 發送
 * 3. Discord 限流與錯誤重試
 * 4. Embed 建立
 * 5. 系統顯示資訊
 **************************************************/

/**************************************************
 * Discord HTTP 核心設定
 **************************************************/
const DISCORD_HTTP_SETTINGS_ = {
  MAX_ATTEMPTS: 4,
  DEFAULT_RETRY_MS: 5000,
  CLOUDFLARE_RETRY_MS: 30000,
  MAX_RETRY_MS: 60000,
  LOCK_WAIT_MS: 30000,
  LAST_REQUEST_PROPERTY: "DISCORD_LAST_REQUEST_AT"
};


/**************************************************
 * 儲存 Discord Webhook URL
 **************************************************/
function setDiscordWebhookUrl() {

  const ui = SpreadsheetApp.getUi();

  const response = ui.prompt(
    "設定 Discord Webhook",
    "請貼上 Discord Webhook URL：",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const webhookUrl = String(
    response.getResponseText() || ""
  ).trim();

  const pattern =
    /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/.+$/i;

  if (!pattern.test(webhookUrl)) {
    throw new Error("Discord Webhook URL 格式不正確");
  }

  PropertiesService
    .getScriptProperties()
    .setProperty(
      CONFIG.DISCORD.WEBHOOK_PROPERTY,
      webhookUrl
    );

  showDiscordToast_(
    "Discord Webhook 已儲存",
    5
  );
}


/**************************************************
 * 取得 Discord Webhook URL
 *
 * @return {string}
 **************************************************/
function getDiscordWebhookUrl_() {

  const webhookUrl = PropertiesService
    .getScriptProperties()
    .getProperty(
      CONFIG.DISCORD.WEBHOOK_PROPERTY
    );

  if (!webhookUrl) {
    throw new Error(
      "找不到 Discord Webhook，請先執行 setDiscordWebhookUrl"
    );
  }

  return webhookUrl;
}


/**************************************************
 * 發送 Discord Webhook
 *
 * @param {Object} payload Discord Payload
 * @return {number} HTTP 狀態碼
 **************************************************/
function sendDiscordWebhook_(payload) {

  validateDiscordEnabled_();

  return sendDiscordRequest_(
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    },
    "Discord 訊息"
  );
}


/**************************************************
 * 發送單一 Discord Embed
 *
 * @param {Object} embed Discord Embed
 * @param {string=} content Discord 一般訊息
 * @return {number}
 **************************************************/
function sendDiscordEmbed_(
  embed,
  content
) {

  const payload = {
    username: getDiscordUsername_(),

    allowed_mentions: {
      parse: []
    },

    embeds: [
      embed
    ]
  };

  if (content) {
    payload.content = String(content);
  }

  return sendDiscordWebhook_(payload);
}


/**************************************************
 * 建立標準 Discord Embed
 *
 * @param {string} title 標題
 * @param {string} description 說明
 * @param {Array<Object>=} fields 欄位
 * @param {number=} color 顏色
 * @return {Object}
 **************************************************/
function createDiscordEmbed_(
  title,
  description,
  fields,
  color
) {

  const embed = {
    title: String(title || ""),
    description: String(description || ""),
    color: Number(color) || getDiscordColor_("DEFAULT"),
    timestamp: new Date().toISOString(),

    footer: {
      text: getDiscordFooter_()
    }
  };

  if (
    Array.isArray(fields) &&
    fields.length > 0
  ) {
    embed.fields = fields;
  }

  return embed;
}


/**************************************************
 * 取得 Discord 功能顏色
 *
 * @param {string} type 類型
 * @return {number}
 **************************************************/
function getDiscordColor_(type) {

  const colors =
    CONFIG.DISCORD &&
      CONFIG.DISCORD.COLORS
      ? CONFIG.DISCORD.COLORS
      : {};

  return Number(
    colors[type] ||
    colors.DEFAULT ||
    3447003
  );
}


/**************************************************
 * 取得 Discord 顯示名稱
 *
 * @return {string}
 **************************************************/
function getDiscordUsername_() {

  return getAppDiscordName();
}


/**************************************************
 * 取得 Discord Footer
 *
 * @return {string}
 **************************************************/
function getDiscordFooter_() {

  return getAppFullName();
}


/**************************************************
 * 顯示 Discord 操作提示
 *
 * @param {string} message 訊息
 * @param {number=} seconds 顯示秒數
 **************************************************/
function showDiscordToast_(
  message,
  seconds
) {

  showToast(
    message,
    Number(seconds) || 5
  );
}


/**************************************************
 * 取得 Discord 發送延遲
 *
 * @return {number}
 **************************************************/
function getDiscordDelay_() {

  return Number(
    CONFIG.DISCORD.LIMITS &&
    CONFIG.DISCORD.LIMITS.REQUEST_DELAY_MS
  ) || 800;
}


/**************************************************
 * 以附件方式發送 Discord Webhook
 *
 * 使用 multipart/form-data 上傳文字檔或 CSV 檔。
 * 不需要將 Blob 儲存至 Google Drive。
 *
 * @param {GoogleAppsScript.Base.Blob} fileBlob 附件 Blob
 * @param {Object=} embed Discord Embed，可省略
 * @param {string=} content Discord 一般訊息，可省略
 * @return {number} HTTP 狀態碼
 **************************************************/
function sendDiscordFile_(
  fileBlob,
  embed,
  content
) {

  validateDiscordEnabled_();

  if (!fileBlob) {
    throw new Error("Discord 附件不存在");
  }

  const webhookPayload = {
    username: getDiscordUsername_(),

    allowed_mentions: {
      parse: []
    },

    attachments: [
      {
        id: 0,
        filename: fileBlob.getName()
      }
    ]
  };

  if (embed) {
    webhookPayload.embeds = [embed];
  }

  if (content) {
    webhookPayload.content = String(content);
  }

  return sendDiscordRequest_(
    {
      method: "post",

      payload: {
        payload_json: JSON.stringify(webhookPayload),
        "files[0]": fileBlob
      },

      muteHttpExceptions: true
    },
    "Discord 附件"
  );
}


/**************************************************
 * Discord HTTP 統一發送核心
 *
 * 功能：
 * 1. 所有 Discord 訊息與附件共用此函式
 * 2. 避免多個執行程序同時傳送
 * 3. 每次請求之間保留最小間隔
 * 4. HTTP 429 自動依 Retry-After 等待
 * 5. Cloudflare 1015 使用較長等待時間
 * 6. HTTP 500、502、503、504 自動重試
 *
 * @param {Object} options UrlFetchApp.fetch 選項
 * @param {string} requestName 請求名稱
 * @return {number} HTTP 狀態碼
 **************************************************/
function sendDiscordRequest_(
  options,
  requestName
) {

  const lock = LockService.getScriptLock();

  if (
    !lock.tryLock(
      DISCORD_HTTP_SETTINGS_.LOCK_WAIT_MS
    )
  ) {
    throw new Error(
      "Discord 發送忙碌中，請稍後再試"
    );
  }

  try {

    const url =
      getDiscordWebhookUrl_() +
      "?wait=true";

    let lastStatusCode = 0;
    let lastResponseText = "";

    for (
      let attempt = 1;
      attempt <= DISCORD_HTTP_SETTINGS_.MAX_ATTEMPTS;
      attempt++
    ) {

      waitForDiscordRequestInterval_();

      let response;

      try {
        response = UrlFetchApp.fetch(
          url,
          options
        );
      } catch (error) {

        if (
          attempt >=
          DISCORD_HTTP_SETTINGS_.MAX_ATTEMPTS
        ) {
          throw new Error(
            requestName +
            "網路請求失敗｜" +
            getDiscordErrorMessage_(error)
          );
        }

        const networkWaitMs =
          getDiscordBackoffMs_(attempt);

        discordLogWarning_(
          requestName +
          "網路請求失敗，" +
          Math.ceil(networkWaitMs / 1000) +
          " 秒後重試｜第 " +
          attempt +
          " 次"
        );

        Utilities.sleep(networkWaitMs);
        continue;
      }

      recordDiscordRequestTime_();

      lastStatusCode =
        response.getResponseCode();

      lastResponseText =
        response.getContentText() || "";

      if (
        lastStatusCode === 200 ||
        lastStatusCode === 204
      ) {

        if (attempt > 1) {
          discordLogInfo_(
            requestName +
            "重試成功｜HTTP " +
            lastStatusCode +
            "｜第 " +
            attempt +
            " 次"
          );
        }

        return lastStatusCode;
      }

      const shouldRetry =
        isDiscordRetryableStatus_(
          lastStatusCode
        );

      if (
        !shouldRetry ||
        attempt >=
        DISCORD_HTTP_SETTINGS_.MAX_ATTEMPTS
      ) {
        break;
      }

      const retryMs =
        getDiscordRetryDelayMs_(
          response,
          lastResponseText,
          attempt
        );

      discordLogWarning_(
        requestName +
        "暫時失敗｜HTTP " +
        lastStatusCode +
        "｜" +
        Math.ceil(retryMs / 1000) +
        " 秒後重試｜第 " +
        attempt +
        " 次"
      );

      Utilities.sleep(retryMs);
    }

    throw new Error(
      requestName +
      "發送失敗｜HTTP " +
      lastStatusCode +
      "｜" +
      limitDiscordErrorText_(
        lastResponseText
      )
    );

  } finally {
    lock.releaseLock();
  }
}


/**************************************************
 * 驗證 Discord 通知是否啟用
 **************************************************/
function validateDiscordEnabled_() {

  if (
    !CONFIG.DISCORD ||
    CONFIG.DISCORD.ENABLED !== true
  ) {
    throw new Error(
      "Discord 通知目前未啟用"
    );
  }
}


/**************************************************
 * 判斷 HTTP 狀態是否可以重試
 *
 * @param {number} statusCode HTTP 狀態碼
 * @return {boolean}
 **************************************************/
function isDiscordRetryableStatus_(
  statusCode
) {

  return [
    429,
    500,
    502,
    503,
    504
  ].indexOf(
    Number(statusCode)
  ) !== -1;
}


/**************************************************
 * 計算 Discord 重試等待時間
 *
 * 優先順序：
 * 1. Discord JSON 的 retry_after
 * 2. Retry-After HTTP Header
 * 3. Cloudflare 1015 固定較長等待
 * 4. 指數退避
 *
 * @param {GoogleAppsScript.URL_Fetch.HTTPResponse} response
 * @param {string} responseText
 * @param {number} attempt
 * @return {number} 毫秒
 **************************************************/
function getDiscordRetryDelayMs_(
  response,
  responseText,
  attempt
) {

  let retryMs = 0;
  let errorCode = 0;

  try {

    const parsed =
      JSON.parse(
        responseText || "{}"
      );

    errorCode =
      Number(
        parsed.code ||
        parsed.error_code ||
        0
      );

    if (
      parsed.retry_after !== undefined &&
      parsed.retry_after !== null
    ) {
      retryMs =
        normalizeDiscordRetryAfterMs_(
          parsed.retry_after
        );
    }

  } catch (error) {
    // 回應不是 JSON 時繼續讀取 Header
  }

  if (retryMs <= 0) {

    const headers =
      response.getAllHeaders
        ? response.getAllHeaders()
        : {};

    const retryAfterHeader =
      getDiscordHeaderValue_(
        headers,
        "Retry-After"
      );

    retryMs =
      parseDiscordRetryAfterHeaderMs_(
        retryAfterHeader
      );
  }

  if (
    Number(errorCode) === 1015
  ) {
    retryMs = Math.max(
      retryMs,
      DISCORD_HTTP_SETTINGS_.CLOUDFLARE_RETRY_MS
    );
  }

  if (retryMs <= 0) {
    retryMs =
      getDiscordBackoffMs_(attempt);
  }

  retryMs = Math.min(
    retryMs + 500,
    DISCORD_HTTP_SETTINGS_.MAX_RETRY_MS
  );

  return Math.max(
    retryMs,
    1000
  );
}


/**************************************************
 * 將 Discord retry_after 轉換為毫秒
 *
 * Discord 通常回傳秒數，也可能出現毫秒值。
 *
 * @param {*} value retry_after
 * @return {number}
 **************************************************/
function normalizeDiscordRetryAfterMs_(
  value
) {

  const numberValue =
    Number(value);

  if (
    !isFinite(numberValue) ||
    numberValue <= 0
  ) {
    return 0;
  }

  // 小於等於 300 視為秒數
  if (numberValue <= 300) {
    return Math.ceil(
      numberValue * 1000
    );
  }

  // 大於 300 視為毫秒數
  return Math.ceil(numberValue);
}


/**************************************************
 * 解析 Retry-After Header
 *
 * 支援：
 * 1. 秒數
 * 2. HTTP 日期格式
 *
 * @param {*} value Header 值
 * @return {number} 毫秒
 **************************************************/
function parseDiscordRetryAfterHeaderMs_(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const numberValue =
    Number(value);

  if (
    isFinite(numberValue) &&
    numberValue > 0
  ) {
    return normalizeDiscordRetryAfterMs_(
      numberValue
    );
  }

  const retryDate =
    new Date(value);

  if (
    isNaN(
      retryDate.getTime()
    )
  ) {
    return 0;
  }

  return Math.max(
    retryDate.getTime() -
    Date.now(),
    0
  );
}


/**************************************************
 * 不分大小寫取得 HTTP Header
 *
 * @param {Object} headers Headers
 * @param {string} targetName Header 名稱
 * @return {*}
 **************************************************/
function getDiscordHeaderValue_(
  headers,
  targetName
) {

  const target =
    String(targetName || "")
      .toLowerCase();

  const keys =
    Object.keys(
      headers || {}
    );

  for (
    let i = 0;
    i < keys.length;
    i++
  ) {

    if (
      String(keys[i])
        .toLowerCase() === target
    ) {
      return headers[keys[i]];
    }
  }

  return "";
}


/**************************************************
 * 指數退避等待時間
 *
 * 第 1 次：5 秒
 * 第 2 次：10 秒
 * 第 3 次：20 秒
 *
 * @param {number} attempt 已完成嘗試次數
 * @return {number} 毫秒
 **************************************************/
function getDiscordBackoffMs_(
  attempt
) {

  const multiplier =
    Math.pow(
      2,
      Math.max(
        Number(attempt) - 1,
        0
      )
    );

  return Math.min(
    DISCORD_HTTP_SETTINGS_.DEFAULT_RETRY_MS *
    multiplier,
    DISCORD_HTTP_SETTINGS_.MAX_RETRY_MS
  );
}


/**************************************************
 * 控制 Discord 請求最小間隔
 **************************************************/
function waitForDiscordRequestInterval_() {

  const properties =
    PropertiesService
      .getScriptProperties();

  const lastRequestAt =
    Number(
      properties.getProperty(
        DISCORD_HTTP_SETTINGS_
          .LAST_REQUEST_PROPERTY
      ) || 0
    );

  const minimumDelay =
    getDiscordDelay_();

  const elapsed =
    Date.now() -
    lastRequestAt;

  if (
    lastRequestAt > 0 &&
    elapsed < minimumDelay
  ) {
    Utilities.sleep(
      minimumDelay - elapsed
    );
  }
}


/**************************************************
 * 紀錄最近一次 Discord 請求時間
 **************************************************/
function recordDiscordRequestTime_() {

  PropertiesService
    .getScriptProperties()
    .setProperty(
      DISCORD_HTTP_SETTINGS_
        .LAST_REQUEST_PROPERTY,
      String(Date.now())
    );
}


/**************************************************
 * 限制 Discord 錯誤內容長度
 *
 * @param {string} text 原始回應
 * @return {string}
 **************************************************/
function limitDiscordErrorText_(
  text
) {

  const value =
    String(text || "")
      .replace(/\s+/g, " ")
      .trim();

  if (!value) {
    return "Discord 未回傳錯誤內容";
  }

  return value.length > 600
    ? value.substring(0, 600) + "…"
    : value;
}


/**************************************************
 * 取得錯誤訊息
 *
 * @param {*} error 錯誤物件
 * @return {string}
 **************************************************/
function getDiscordErrorMessage_(
  error
) {

  if (
    error &&
    error.message
  ) {
    return String(error.message);
  }

  return String(
    error || "未知錯誤"
  );
}


/**************************************************
 * 安全寫入 Discord 資訊日誌
 *
 * 專案沒有 SystemLog 模組時不會造成錯誤。
 *
 * @param {string} message 訊息
 **************************************************/
function discordLogInfo_(
  message
) {

  if (
    typeof systemLogInfo ===
    "function"
  ) {
    systemLogInfo(
      "Discord",
      message
    );
    return;
  }

  console.log(
    "[Discord][INFO] " +
    message
  );
}


/**************************************************
 * 安全寫入 Discord 警告日誌
 *
 * 專案沒有 SystemLog 模組時不會造成錯誤。
 *
 * @param {string} message 訊息
 **************************************************/
function discordLogWarning_(
  message
) {

  if (
    typeof systemLogWarning ===
    "function"
  ) {
    systemLogWarning(
      "Discord",
      message
    );
    return;
  }

  console.warn(
    "[Discord][WARNING] " +
    message
  );
}
