/**************************************************
 * WWM Redeem Code Tracker V2.0
 * NewCodes.gs
 *
 * 功能：
 * 1. 將「新增兌換碼」作為首次發現事件紀錄
 * 2. 同一兌換碼永久只記錄一次
 * 3. 記錄 API 加入時間、首次發現時間及更新批次
 * 4. 使用文件鎖避免排程與手動更新同時執行
 **************************************************/

/**************************************************
 * 更新新增兌換碼工作表
 *
 * 欄位：
 * A：發現日期
 * B：兌換碼
 * C：API 加入時間
 * D：首次發現時間
 * E：更新批次
 *
 * @param {Array<Object>} active API 回傳的可用兌換碼
 * @return {number} 本次新增數量
 **************************************************/


/**************************************************
 * 函式：updateNewCodes
 *
 * 說明：此函式為系統模組的公開或內部處理程序。
 **************************************************/
function updateNewCodes(active) {

  // 清空上一次執行留下的新增資料
  LAST_NEW_CODES = [];

  // API 資料不是陣列時，使用空陣列避免程式中斷
  const activeCodes = Array.isArray(active)
    ? active
    : [];

  // 建立文件鎖，避免多個更新程序同時寫入
  const lock = LockService.getDocumentLock();

  // 最多等待鎖定 30 秒
  lock.waitLock(30000);

  try {

    // 取得新增兌換碼工作表
    const sheet = getSheet(CONFIG.SHEETS.NEW);

    // 工作表不存在時停止執行
    if (!sheet) {
      throw new Error("找不到新增兌換碼工作表");
    }

    // 建立或修正標題列
    ensureNewCodesHeader_(sheet);

    // 取得已記錄過的兌換碼
    const existingCodes = getExistingNewCodes_(sheet);

    // 取得目前時間
    const now = new Date();

    // 產生本次更新批次編號
    const batchId = createNewCodeBatchId_(now);

    // 儲存本次需要新增的資料
    const rows = [];

    // 逐筆檢查目前可用兌換碼
    activeCodes.forEach(function (item) {

      // 排除無效資料
      if (!item || !item.code) {
        return;
      }

      // 統一兌換碼格式
      const code = normalizeNewCode_(item.code);

      // 排除空白或已經記錄過的兌換碼
      if (!code || existingCodes.has(code)) {
        return;
      }

      // 轉換 API 加入時間
      const apiAddedAt = normalizeApiDate_(item.addedAt);

      // 寫入首次發現事件
      rows.push([
        now,
        code,
        apiAddedAt || "",
        now,
        batchId
      ]);

      // 保存本次新增資料，供 Discord 通知使用
      LAST_NEW_CODES.push({
        code: code,
        addedAt: apiAddedAt,
        discoveredAt: now,
        batchId: batchId
      });

      // 立即加入記憶體集合，避免同一次 API 資料內重複
      existingCodes.add(code);

    });

    // 本次沒有新兌換碼時，清空「上次更新新增」快照後返回
    if (rows.length === 0) {
      saveLastNewCodesSnapshot_([]);
      return 0;
    }

    // 計算資料寫入起始列
    const startRow = sheet.getLastRow() + 1;

    // 一次寫入所有新增資料
    sheet.getRange(
      startRow,
      1,
      rows.length,
      5
    ).setValues(rows);

    /**************************************************
     * 套用新增資料格式
     **************************************************/

    // 發現日期只顯示年月日
    sheet.getRange(
      startRow,
      1,
      rows.length,
      1
    ).setNumberFormat("yyyy/MM/dd");

    // 兌換碼使用純文字格式
    sheet.getRange(
      startRow,
      2,
      rows.length,
      1
    ).setNumberFormat("@");

    // API 加入時間與首次發現時間
    sheet.getRange(
      startRow,
      3,
      rows.length,
      2
    ).setNumberFormat("yyyy/MM/dd HH:mm:ss");

    // 更新批次使用純文字格式
    sheet.getRange(
      startRow,
      5,
      rows.length,
      1
    ).setNumberFormat("@");

    // 確保資料立即寫入
    SpreadsheetApp.flush();

    // 將本次真正新增的兌換碼保存為最後一次更新快照
    // 手動 Discord 傳送只讀取此快照，不再重新掃描工作表。
    saveLastNewCodesSnapshot_(LAST_NEW_CODES);

    // 回傳本次新增數量
    return rows.length;

  } finally {

    // 無論成功或失敗都釋放文件鎖
    lock.releaseLock();

  }

}


/**************************************************
 * 建立或修正新增兌換碼標題列
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 **************************************************/

function ensureNewCodesHeader_(sheet) {

  // 新增兌換碼工作表固定欄位
  const headers = [
    "發現日期",
    "兌換碼",
    "API 加入時間",
    "首次發現時間",
    "更新批次"
  ];

  // 寫入標題列
  sheet.getRange(
    1,
    1,
    1,
    headers.length
  ).setValues([headers]);

  // 凍結標題列
  sheet.setFrozenRows(1);

}


/**************************************************
 * 讀取已存在的兌換碼
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {Set<string>} 已存在的兌換碼集合
 **************************************************/

function getExistingNewCodes_(sheet) {

  // 建立兌換碼集合
  const codes = new Set();

  // 取得最後資料列
  const lastRow = sheet.getLastRow();

  // 沒有歷史資料時返回空集合
  if (lastRow <= 1) {
    return codes;
  }

  // 讀取 B 欄兌換碼
  const values = sheet.getRange(
    2,
    2,
    lastRow - 1,
    1
  ).getDisplayValues();

  // 將現有兌換碼加入集合
  values.forEach(function (row) {

    // 統一兌換碼格式
    const code = normalizeNewCode_(row[0]);

    // 排除空白值
    if (code) {
      codes.add(code);
    }

  });

  return codes;

}


/**************************************************
 * 統一兌換碼格式
 *
 * @param {*} value 原始兌換碼
 * @return {string} 標準化後的兌換碼
 **************************************************/

function normalizeNewCode_(value) {

  // 空值直接返回空字串
  if (value === null || value === undefined) {
    return "";
  }

  // 移除前後空白並統一為大寫
  return String(value)
    .trim()
    .toUpperCase();

}


/**************************************************
 * API 日期轉換
 *
 * @param {*} value API 日期資料
 * @return {Date|null} 有效日期或 null
 **************************************************/

function normalizeApiDate_(value) {

  // 空值不進行轉換
  if (!value) {
    return null;
  }

  // 已經是有效 Date 物件時直接返回
  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  // 嘗試轉換為 Date 物件
  const date = new Date(value);

  // 無效日期返回 null
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;

}


/**************************************************
 * 建立更新批次編號
 *
 * 格式：
 * YAR-20260729-091522
 *
 * @param {Date} date 更新時間
 * @return {string} 更新批次編號
 **************************************************/

function createNewCodeBatchId_(date) {

  // 取得專案時區
  const timeZone =
    Session.getScriptTimeZone() ||
    "Asia/Taipei";

  // 建立唯一批次編號
  return "YAR-" + Utilities.formatDate(
    date,
    timeZone,
    "yyyyMMdd-HHmmss"
  );

}

/**************************************************
 * 儲存本次新增兌換碼
 *
 * 僅供目前一次 updateAll 執行期間使用
 **************************************************/

let LAST_NEW_CODES = [];

/**************************************************
 * 最後一次更新新增兌換碼的 Script Properties 鍵名
 *
 * 此快照只代表最近一次成功執行 updateNewCodes()
 * 所辨識出的真正新增兌換碼。
 **************************************************/
const LAST_NEW_CODES_PROPERTY =
  "WWM_LAST_NEW_CODES_SNAPSHOT";


/**************************************************
 * 儲存最後一次更新新增兌換碼快照
 *
 * 用途：
 * 1. updateAll 執行期間直接使用 LAST_NEW_CODES 自動通知
 * 2. 更新完成後，選單手動傳送可讀取相同結果
 * 3. 不再依工作表最新批次重新判斷，避免舊碼被重送
 *
 * @param {Array<Object|string>} items 本次真正新增資料
 * @return {void}
 **************************************************/
function saveLastNewCodesSnapshot_(items) {

  const normalizedItems =
    (Array.isArray(items) ? items : [])
      .map(function (item) {

        const code = normalizeNewCode_(
          item && typeof item === "object"
            ? (item.code || item.Code || item.redeemCode || "")
            : item
        );

        if (!code) {
          return null;
        }

        return {
          code: code,
          addedAt:
            item && typeof item === "object" && item.addedAt
              ? new Date(item.addedAt).toISOString()
              : "",
          discoveredAt:
            item && typeof item === "object" && item.discoveredAt
              ? new Date(item.discoveredAt).toISOString()
              : new Date().toISOString(),
          batchId:
            item && typeof item === "object"
              ? String(item.batchId || "")
              : ""
        };

      })
      .filter(function (item) {
        return item !== null;
      });

  PropertiesService
    .getScriptProperties()
    .setProperty(
      LAST_NEW_CODES_PROPERTY,
      JSON.stringify(normalizedItems)
    );

}


/**************************************************
 * 取得最後一次更新新增兌換碼快照
 *
 * 注意：
 * 此函式不讀取「新增兌換碼」工作表，也不依日期、
 * API 加入時間或更新批次重新判斷。
 *
 * @return {Array<Object>} 最後一次更新真正新增的兌換碼
 **************************************************/
function getLastNewCodesSnapshot_() {

  const rawValue = PropertiesService
    .getScriptProperties()
    .getProperty(LAST_NEW_CODES_PROPERTY);

  if (!rawValue) {
    return [];
  }

  try {

    const parsed = JSON.parse(rawValue);

    return Array.isArray(parsed)
      ? parsed.filter(function (item) {
          return item && normalizeNewCode_(item.code);
        })
      : [];

  } catch (error) {

    console.error(
      "新增兌換碼快照解析失敗：",
      error
    );

    return [];

  }

}

