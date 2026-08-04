/**************************************************
 * WWM Redeem Code Tracker V2.0
 * Utils.gs
 **************************************************/

/**
 * 取得 Spreadsheet
 */
function getSS() {
  return SpreadsheetApp.getActive();
}

/**
 * 取得 Sheet
 */
function getSheet(name) {

  const ss = getSS();

  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  return sheet;
}

/**
 * 清空 Sheet
 */
function clearSheet(sheet) {

  sheet.clearContents();
  sheet.clearFormats();

}

/**
 * Toast
 */
function toast(message) {

  SpreadsheetApp
    .getActive()
    .toast(message, "YAR Tracker", 3);

}

/**
 * 現在時間
 */
function now() {

  return new Date();

}

/**
 * 台灣時間字串
 */
function formatDate(date) {

  if (!date) return "";

  return Utilities.formatDate(
    new Date(date),
    "Asia/Taipei",
    "yyyy/MM/dd HH:mm:ss"
  );

}

/**
 * ISO 時間
 */
function formatISO(date){

  if(!date) return "";

  return Utilities.formatDate(
      new Date(date),
      "GMT",
      "yyyy-MM-dd'T'HH:mm:ss'Z'"
  );

}

/**
 * 工作表是否存在
 */
function sheetExists(name){

  return getSS().getSheetByName(name)!=null;

}

/**
 * 自動調整欄寬
 */
function autoResize(sheet){

  const cols = sheet.getLastColumn();

  for(let i=1;i<=cols;i++){

      sheet.autoResizeColumn(i);

  }

}

/**
 * 套用 Header
 */
function setHeader(sheet,header){

  sheet
    .getRange(
        1,
        1,
        1,
        header.length
    )
    .setValues([header]);

}

/**
 * 寫入 Table
 */
function setTable(sheet,header,rows){

  clearSheet(sheet);

  setHeader(sheet,header);

  if(rows.length){

      sheet
      .getRange(
          2,
          1,
          rows.length,
          header.length
      )
      .setValues(rows);

  }

  sheet.setFrozenRows(1);

  autoResize(sheet);

}

/**
 * Dashboard Key/Value
 */
function dashboardRow(sheet,row,key,value){

    sheet
      .getRange(row,1)
      .setValue(key);

    sheet
      .getRange(row,2)
      .setValue(value);

}
