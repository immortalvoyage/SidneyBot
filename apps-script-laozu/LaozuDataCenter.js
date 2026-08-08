const LAOZU_DATA_CENTER_MEMBER_SHEET = "成員關係值";
const LAOZU_DATA_CENTER_MOOD_SHEET = "老祖心情狀態";
const LAOZU_DATA_CENTER_STATUS_SHEET = "系統同步狀態";

const LAOZU_DATA_CENTER_MEMBER_HEADERS = ["玩家ID", "顯示名稱", "身分", "好感度", "信任度", "芥蒂值", "今日耐心", "互動層級", "連續請安", "累計請安", "最長連續", "上次請安", "最後原因", "最後更新", "資料來源", "備註"];
const LAOZU_DATA_CENTER_MOOD_HEADERS = ["時間", "綜合心情", "語氣", "愉悅", "安全感", "疲勞", "信任", "社群壓力", "互動次數", "訊號次數", "最後訊號時間", "資料來源", "版本", "備註"];
const LAOZU_DATA_CENTER_STATUS_HEADERS = ["模組", "狀態", "最後同步時間", "最後成功時間", "最後錯誤", "版本", "資料來源", "備註"];

function syncLaozuMemberRelation_(payload) {
  const member = payload.member || {};
  const userId = String(member.userId || "");
  if (!/^\d{6,24}$/.test(userId)) throw new Error("成員關係缺少有效玩家ID");
  const sheet = ensureLaozuDataCenterSheet_(LAOZU_DATA_CENTER_MEMBER_SHEET, LAOZU_DATA_CENTER_MEMBER_HEADERS);
  const row = findLaozuDataCenterRow_(sheet, 1, userId);
  sheet.getRange(row, 1, 1, LAOZU_DATA_CENTER_MEMBER_HEADERS.length).setValues([[
    userId,
    String(member.displayName || ""),
    String(member.rank || ""),
    numberOrBlank_(member.favor),
    numberOrBlank_(member.trust),
    numberOrBlank_(member.grudge),
    numberOrBlank_(member.patienceToday),
    String(member.interactionTier || ""),
    numberOrZero_(member.currentStreak),
    numberOrZero_(member.totalDays),
    numberOrZero_(member.longestStreak),
    String(member.lastDate || ""),
    String(member.lastReason || ""),
    new Date(),
    String(payload.source || "worker"),
    String(member.note || "")
  ]]);
  return { row: row };
}

function syncLaozuMoodState_(payload) {
  const mood = payload.mood || {};
  const sheet = ensureLaozuDataCenterSheet_(LAOZU_DATA_CENTER_MOOD_SHEET, LAOZU_DATA_CENTER_MOOD_HEADERS);
  sheet.appendRow([
    new Date(),
    numberOrBlank_(mood.score),
    String(mood.tone || ""),
    numberOrBlank_(mood.joy),
    numberOrBlank_(mood.safety),
    numberOrBlank_(mood.fatigue),
    numberOrBlank_(mood.trust),
    numberOrBlank_(mood.communityPressure),
    numberOrZero_(mood.interactionCount),
    numberOrZero_(mood.signalCount),
    String(mood.lastSignalAt || ""),
    String(payload.source || "worker"),
    String(payload.version || ""),
    String(payload.note || "")
  ]);
  return { row: sheet.getLastRow() };
}

function syncLaozuSystemStatus_(payload) {
  const moduleName = String(payload.module || "").trim();
  if (!moduleName) throw new Error("同步狀態缺少模組名稱");
  const sheet = ensureLaozuDataCenterSheet_(LAOZU_DATA_CENTER_STATUS_SHEET, LAOZU_DATA_CENTER_STATUS_HEADERS);
  const row = findLaozuDataCenterRow_(sheet, 1, moduleName);
  const now = new Date();
  const ok = payload.ok !== false;
  const previousSuccess = row > 1 ? sheet.getRange(row, 4).getValue() : "";
  sheet.getRange(row, 1, 1, LAOZU_DATA_CENTER_STATUS_HEADERS.length).setValues([[
    moduleName,
    ok ? "正常" : "異常",
    now,
    ok ? now : previousSuccess,
    ok ? "" : String(payload.error || ""),
    String(payload.version || ""),
    String(payload.source || "worker"),
    String(payload.note || "")
  ]]);
  return { row: row };
}

function ensureLaozuDataCenterSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  else {
    const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    if (current.join("|") !== headers.join("|")) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  return sheet;
}

function findLaozuDataCenterRow_(sheet, keyColumn, keyValue) {
  if (sheet.getLastRow() < 2) return 2;
  const range = sheet.getRange(2, keyColumn, sheet.getLastRow() - 1, 1);
  const match = range.createTextFinder(String(keyValue)).matchEntireCell(true).findNext();
  return match ? match.getRow() : sheet.getLastRow() + 1;
}

function numberOrBlank_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function numberOrZero_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
