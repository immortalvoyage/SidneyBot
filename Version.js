/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Version.gs
 *
 * 職責：
 * 1. 統一提供系統名稱
 * 2. 統一提供系統版本
 * 3. 統一提供完整名稱
 * 4. 統一提供作者資訊
 **************************************************/

/**************************************************
 * 取得系統名稱
 *
 * @return {string}
 **************************************************/
function getAppName() {

  return (
    CONFIG.APP &&
    CONFIG.APP.NAME
  ) || "WWM Redeem Code Tracker";
}


/**************************************************
 * 取得系統版本
 *
 * @return {string}
 **************************************************/
function getAppVersion() {

  return (
    CONFIG.APP &&
    CONFIG.APP.VERSION
  ) || "V1.0";
}


/**************************************************
 * 取得系統完整名稱
 *
 * @return {string}
 **************************************************/
function getAppFullName() {

  return (
    getAppName() +
    " " +
    getAppVersion()
  );
}


/**************************************************
 * 取得 Discord 顯示名稱
 *
 * @return {string}
 **************************************************/
function getAppDiscordName() {

  return (
    CONFIG.APP &&
    CONFIG.APP.DISCORD_NAME
  ) || getAppName();
}


/**************************************************
 * 取得 Toast 標題
 *
 * @return {string}
 **************************************************/
function getAppToastTitle() {

  return (
    CONFIG.APP &&
    CONFIG.APP.TOAST_TITLE
  ) || getAppName();
}


/**************************************************
 * 取得開發者資訊
 *
 * @return {string}
 **************************************************/
function getAppAuthor() {

  return (
    CONFIG.APP &&
    CONFIG.APP.AUTHOR
  ) || "";
}
