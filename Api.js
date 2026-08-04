/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Api.gs
 *
 * 功能：
 * 1. 取得兌換碼 API 資料
 * 2. 支援最多 3 次重試
 * 3. 儲存 API 狀態與執行耗時
 * 4. 寫入標準化系統錯誤紀錄
 **************************************************/

/**************************************************
 * 取得 API 資料
 *
 * @return {{
 *   updatedAt: string,
 *   active: Array,
 *   expired: Array
 * }}
 **************************************************/
function getApiData() {

  // 取得 API 原始 JSON
  const json =
    fetchJson_(
      CONFIG.API.URL
    );

  // 回傳標準化資料
  return {
    updatedAt:
      json.updatedAt || "",

    active:
      Array.isArray(json.active)
        ? json.active
        : [],

    expired:
      Array.isArray(json.expired)
        ? json.expired
        : []
  };
}


/**************************************************
 * 下載並解析 JSON
 *
 * 規則：
 * 1. 最多重試 3 次
 * 2. HTTP 狀態必須為 200
 * 3. 回傳內容不得為空白
 * 4. active 與 expired 必須存在
 *
 * @param {string} url API URL
 * @return {Object}
 **************************************************/
function fetchJson_(url) {

  // API 請求設定
  const options = {
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true,
    validateHttpsCertificates: true
  };

  // 最大重試次數
  const maxAttempts = 3;

  // 保存最後一次錯誤
  let lastError = null;

  // 保存最後一次 HTTP 狀態碼
  let lastHttpCode = 0;

  // 記錄整體 API 請求開始時間
  const apiStartTime =
    Date.now();

  // 依設定次數進行重試
  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {

    try {

      // 發送 HTTP 請求
      const response =
        UrlFetchApp.fetch(
          url,
          options
        );

      // 取得 HTTP 狀態碼
      const httpCode =
        response.getResponseCode();

      lastHttpCode =
        httpCode;

      // 驗證 HTTP 狀態碼
      if (httpCode !== 200) {
        throw new Error(
          "HTTP " + httpCode
        );
      }

      // 取得回傳內容
      const responseText =
        response.getContentText();

      // 驗證回傳內容
      if (!responseText) {
        throw new Error(
          "API 回傳空白"
        );
      }

      // 解析 JSON
      const json =
        JSON.parse(
          responseText
        );

      // 驗證 API 資料格式
      if (
        !Array.isArray(json.active) ||
        !Array.isArray(json.expired)
      ) {
        throw new Error(
          "API 格式錯誤"
        );
      }

      // 計算 API 執行耗時
      const durationMs =
        Date.now() -
        apiStartTime;

      // 儲存 API 成功狀態
      saveApiSuccessStatus(
        httpCode,
        durationMs
      );

      // 寫入成功紀錄
      systemLogInfo(
        "API 資料取得成功",
        {
          module: "Api.gs",
          function: "fetchJson_",
          attempt: attempt,
          httpCode: httpCode,
          durationMs: durationMs,
          activeCount:
            json.active.length,
          expiredCount:
            json.expired.length
        }
      );

      return json;

    } catch (error) {

      // 保存最後一次錯誤
      lastError =
        error instanceof Error
          ? error
          : new Error(
            String(error || "未知錯誤")
          );

      // 寫入重試警告
      systemLogWarning(
        "API 請求失敗，準備重試",
        {
          module: "Api.gs",
          function: "fetchJson_",
          attempt: attempt,
          maxAttempts: maxAttempts,
          httpCode: lastHttpCode,
          error:
            lastError.message
        }
      );

      // 未達最大次數時等待 1 秒
      if (attempt < maxAttempts) {
        Utilities.sleep(1000);
      }
    }
  }

  // 計算總執行耗時
  const durationMs =
    Date.now() -
    apiStartTime;

  // 建立最終錯誤
  const finalError =
    new Error(
      "API 連線失敗：" +
      (
        lastError
          ? lastError.message
          : "未知錯誤"
      )
    );

  // 儲存 API 失敗狀態
  saveApiErrorStatus(
    finalError,
    lastHttpCode,
    durationMs
  );

  // 寫入系統錯誤紀錄
  systemLogError(
    finalError,
    {
      module: "Api.gs",
      function: "fetchJson_",
      attempts: maxAttempts,
      httpCode: lastHttpCode,
      durationMs: durationMs
    }
  );

  throw finalError;
}


/**************************************************
 * 測試 API
 *
 * 手動執行：
 * testApi
 **************************************************/
function testApi() {

  try {

    // 取得 API 資料
    const api =
      getApiData();

    // 取得目前 API 狀態
    const apiStatus =
      getApiStatus();

    // 輸出測試結果
    console.log(
      JSON.stringify(
        {
          updatedAt:
            api.updatedAt,

          activeCount:
            api.active.length,

          expiredCount:
            api.expired.length,

          firstActive:
            api.active.length > 0
              ? api.active[0]
              : null,

          apiStatus:
            apiStatus
        },
        null,
        2
      )
    );

    // 顯示成功提示
    showSuccessToast(
      "API 測試成功｜HTTP " +
      apiStatus.httpCode +
      "｜" +
      apiStatus.durationMs +
      " ms",
      8
    );

  } catch (error) {

    // 顯示錯誤提示
    showErrorToast(
      error.message,
      10
    );

    throw error;
  }
}
