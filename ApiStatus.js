/**************************************************
 * WWM Redeem Code Tracker V2.0
 * ApiStatus.gs
 *
 * 職責：
 * 1. 儲存最近一次 API 狀態
 * 2. 提供 Dashboard 與 Discord 共用
 * 3. 儲存 HTTP 狀態與執行耗時
 **************************************************/

const API_STATUS_KEYS = {

  STATUS:
    "WWM_API_LAST_STATUS",

  HTTP_CODE:
    "WWM_API_LAST_HTTP_CODE",

  DURATION:
    "WWM_API_LAST_DURATION",

  UPDATE_TIME:
    "WWM_API_LAST_UPDATE_TIME",

  ERROR:
    "WWM_API_LAST_ERROR"

};


/**************************************************
 * 儲存 API 成功狀態
 *
 * @param {number} httpCode HTTP 狀態碼
 * @param {number} durationMs 執行耗時
 **************************************************/
function saveApiSuccessStatus(
  httpCode,
  durationMs
) {

  const properties =
    PropertiesService.getScriptProperties();

  properties.setProperties({
    [API_STATUS_KEYS.STATUS]:
      "正常",

    [API_STATUS_KEYS.HTTP_CODE]:
      String(Number(httpCode) || 200),

    [API_STATUS_KEYS.DURATION]:
      String(Number(durationMs) || 0),

    [API_STATUS_KEYS.UPDATE_TIME]:
      new Date().toISOString(),

    [API_STATUS_KEYS.ERROR]:
      ""
  });
}


/**************************************************
 * 儲存 API 失敗狀態
 *
 * @param {Error|string} error 錯誤資訊
 * @param {number=} httpCode HTTP 狀態碼
 * @param {number=} durationMs 執行耗時
 **************************************************/
function saveApiErrorStatus(
  error,
  httpCode,
  durationMs
) {

  const errorMessage =
    error instanceof Error
      ? error.message
      : String(error || "未知錯誤");

  const properties =
    PropertiesService.getScriptProperties();

  properties.setProperties({
    [API_STATUS_KEYS.STATUS]:
      "異常",

    [API_STATUS_KEYS.HTTP_CODE]:
      String(Number(httpCode) || 0),

    [API_STATUS_KEYS.DURATION]:
      String(Number(durationMs) || 0),

    [API_STATUS_KEYS.UPDATE_TIME]:
      new Date().toISOString(),

    [API_STATUS_KEYS.ERROR]:
      errorMessage
  });
}


/**************************************************
 * 取得最近一次 API 狀態
 *
 * @return {Object}
 **************************************************/
function getApiStatus() {

  const properties =
    PropertiesService.getScriptProperties();

  const status =
    properties.getProperty(
      API_STATUS_KEYS.STATUS
    ) || "尚未執行";

  const httpCode =
    Number(
      properties.getProperty(
        API_STATUS_KEYS.HTTP_CODE
      )
    ) || 0;

  const durationMs =
    Number(
      properties.getProperty(
        API_STATUS_KEYS.DURATION
      )
    ) || 0;

  const updateTimeValue =
    properties.getProperty(
      API_STATUS_KEYS.UPDATE_TIME
    );

  const errorMessage =
    properties.getProperty(
      API_STATUS_KEYS.ERROR
    ) || "";

  return {
    status: status,
    httpCode: httpCode,
    durationMs: durationMs,
    updateTime:
      formatApiStatusTime_(
        updateTimeValue
      ),
    error: errorMessage,
    isHealthy:
      status === "正常" &&
      httpCode >= 200 &&
      httpCode < 300
  };
}


/**************************************************
 * 格式化 API 狀態時間
 *
 * @param {string} value ISO 日期
 * @return {string}
 **************************************************/
function formatApiStatusTime_(
  value
) {

  if (!value) {
    return "尚未執行";
  }

  const date =
    new Date(value);

  if (isNaN(date.getTime())) {
    return "尚未執行";
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "yyyy/MM/dd HH:mm:ss"
  );
}
