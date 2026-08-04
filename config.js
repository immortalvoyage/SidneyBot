/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Config.gs
 **************************************************/

const CONFIG = {

  /**************************************************
   * Application
   **************************************************/
  APP: {

    // 專案顯示名稱
    NAME: "🎮 WWM Redeem Code Tracker",

    // 專案版本
    VERSION: "V2.0",

    // Discord 顯示名稱
    DISCORD_NAME: "🎮 WWM Redeem Code Tracker",

    // Google Sheets 提示標題
    TOAST_TITLE: "WWM Redeem Code Tracker",

    // 開發者資訊
    AUTHOR: "百業：仙遊者 No:10129276　Coder：凜冬皓月"

  },

  /**************************************************
   * API
   **************************************************/
  API: {
    URL: "https://codes.yar.gg/api/codes",
    TIMEOUT: 30000
  },

  /**************************************************
   * Sheet Names
   **************************************************/
  SHEETS: {

    DASHBOARD: "Dashboard",

    ACTIVE: "可用兌換碼",

    EXPIRED: "已失效兌換碼",

    NEW: "新增兌換碼",

    HISTORY: "歷史紀錄",

    LOG: "Log"

  },

  /**************************************************
   * Active Header
   **************************************************/
  HEADER_ACTIVE: [

    "Code",

    "Added",

    "Verified"

  ],

  /**************************************************
   * Expired Header
   **************************************************/
  HEADER_EXPIRED: [

    "Code",

    "Added",

    "Verified",

    "Expired"

  ],

  /**************************************************
   * 新增兌換碼工作表標題
   **************************************************/

  HEADER_NEW: [
    "發現日期",
    "兌換碼",
    "API 加入時間",
    "首次發現時間",
    "更新批次"
  ],

  /**************************************************
   * History Header
   **************************************************/
  HEADER_HISTORY: [

    "Code",

    "Status",

    "First Seen",

    "Last Seen",

    "Added",

    "Verified",

    "Expired"

  ],

  /**************************************************
   * Log Header
   **************************************************/
  HEADER_LOG: [

    "Time",

    "Active",

    "Expired",

    "New",

    "Duration(ms)",

    "Result"

  ],

/**************************************************
 * Dashboard 設定
 **************************************************/
DASHBOARD: {

  // Dashboard 副標題
  SUBTITLE: "燕雲十六聲｜兌換碼監控系統",

  // 最後更新資料列
  LAST_UPDATE_ROW: 3,

  // API 狀態資料列
  API_STATUS_ROW: 4,

  // 可用數量資料列
  ACTIVE_ROW: 5,

  // 已失效數量資料列
  EXPIRED_ROW: 6,

  // 新增數量資料列
  NEW_ROW: 7,

  // 總數資料列
  TOTAL_ROW: 8,

  // 更新耗時資料列
  COST_ROW: 9

},

  /**************************************************
   * Discord 整合設定
   **************************************************/
  DISCORD: {

    // 是否啟用 Discord 通知
    ENABLED: true,

    // Webhook 儲存於 Script Properties 的鍵名
    WEBHOOK_PROPERTY: "DISCORD_WEBHOOK_URL",

    // Discord Embed 功能顏色
    COLORS: {
      DEFAULT: 3447003,
      TEST: 1752220,
      NEW: 5763719,
      ACTIVE: 3447003,
      EXPIRED: 15548997,
      STATISTICS: 16766720,
      REPORT: 10181046
    },

    // Discord 訊息限制
    LIMITS: {
      ITEMS_PER_BATCH: 40,
      DESCRIPTION_LENGTH: 3500,
      REQUEST_DELAY_MS: 800
    }
  }
};

/**************************************************
 * Colors
 **************************************************/

const COLORS = {

  HEADER: "#263238",

  HEADER_FONT: "#FFFFFF",

  SUCCESS: "#C8E6C9",

  WARNING: "#FFE082",

  ERROR: "#FFCDD2",

  NEW: "#FFF59D",

  ACTIVE: "#E3F2FD"

};
