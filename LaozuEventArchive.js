const LAOZU_EVENT_ARCHIVE_SHEET = "老祖事件記憶";
const LAOZU_EVENT_ARCHIVE_HEADERS = ["事件ID", "伺服器ID", "頻道ID", "敘述者ID", "相關玩家ID", "事件內容", "來源", "查證狀態", "事件時間", "歸檔時間", "可見範圍", "行為觀察JSON"];

function doPost(e) {
  try {
    const request = JSON.parse(String(e && e.postData && e.postData.contents || "{}"));
    validateLaozuEventArchiveRequest_(request);
    const action = String(request.payload.action || "");
    if (action === "health") return jsonLaozuEventArchiveResponse_({ ok: true, service: "laozu-data-center", capabilities: { append: true, query: true, deleteUser: true, syncMemberRelation: true, syncMood: true, syncStatus: true } });
    if (action === "query") return jsonLaozuEventArchiveResponse_({ ok: true, events: queryLaozuEventArchive_(request.payload) });
    if (action === "delete_user") return jsonLaozuEventArchiveResponse_({ ok: true, deleted: deleteLaozuUserEvents_(request.payload) });
    if (action === "sync_member_relation") return jsonLaozuEventArchiveResponse_({ ok: true, result: syncLaozuMemberRelation_(request.payload) });
    if (action === "sync_mood") return jsonLaozuEventArchiveResponse_({ ok: true, result: syncLaozuMoodState_(request.payload) });
    if (action === "sync_status") return jsonLaozuEventArchiveResponse_({ ok: true, result: syncLaozuSystemStatus_(request.payload) });
    const result = appendLaozuEventArchive_(request.payload.event);
    return jsonLaozuEventArchiveResponse_({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    console.error("老祖資料中心處理失敗", error);
    return jsonLaozuEventArchiveResponse_({ ok: false, error: String(error.message || error) });
  }
}

function validateLaozuEventArchiveRequest_(request) {
  const secret = PropertiesService.getScriptProperties().getProperty("LAOZU_EVENT_ARCHIVE_SECRET");
  if (!secret) throw new Error("缺少 LAOZU_EVENT_ARCHIVE_SECRET");
  const timestamp = String(request.timestamp || "");
  const requestId = String(request.requestId || "");
  const signature = String(request.signature || "").toLowerCase();
  const action = String(request && request.payload && request.payload.action || "");
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("請求已過期");
  if (!requestId || !request.payload || !/^(append|query|delete_user|health|sync_member_relation|sync_mood|sync_status)$/.test(action)) throw new Error("請求格式錯誤");
  if (action === "append" && (!request.payload.event || request.payload.event.id !== requestId)) throw new Error("事件格式錯誤");
  if (action === "delete_user" && String(request.payload.requesterId || "") !== String(request.payload.userId || "")) throw new Error("只能刪除自己的事件");
  const content = timestamp + "." + requestId + "." + JSON.stringify(request.payload);
  const expected = Utilities.computeHmacSha256Signature(content, secret).map(function(byte) {
    return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0");
  }).join("");
  if (!constantTimeEqualLaozuArchive_(expected, signature)) throw new Error("簽章錯誤");
}

function deleteLaozuUserEvents_(request) {
  const guildId = String(request.guildId || "");
  const requesterId = String(request.requesterId || "");
  const userId = String(request.userId || "");
  if (!guildId || !requesterId || requesterId !== userId) throw new Error("刪除身分錯誤");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LAOZU_EVENT_ARCHIVE_SHEET);
    if (!sheet || sheet.getLastRow() < 2) return 0;
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, LAOZU_EVENT_ARCHIVE_HEADERS.length).getValues();
    const deleteRows = [];
    rows.forEach(function(row, index) {
      if (String(row[1]) === guildId && String(row[3]) === userId) deleteRows.push(index + 2);
    });
    deleteRows.reverse().forEach(function(rowNumber) { sheet.deleteRow(rowNumber); });
    return deleteRows.length;
  } finally {
    lock.releaseLock();
  }
}

function appendLaozuEventArchive_(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(LAOZU_EVENT_ARCHIVE_SHEET);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(LAOZU_EVENT_ARCHIVE_SHEET);
      sheet.appendRow(LAOZU_EVENT_ARCHIVE_HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, LAOZU_EVENT_ARCHIVE_HEADERS.length).setFontWeight("bold");
    }
    const eventId = String(event.id || "");
    const duplicate = sheet.getLastRow() > 1 && Boolean(sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(eventId).matchEntireCell(true).findNext());
    if (duplicate) return { duplicate: true };
    sheet.appendRow([eventId, String(event.guildId || ""), String(event.channelId || ""), String(event.actorId || ""), (event.participantIds || []).join(","), String(event.text || ""), String(event.source || ""), String(event.verification || ""), String(event.createdAt || ""), new Date(), String(event.scope || "public"), JSON.stringify(event.observations || {})]);
    return { duplicate: false };
  } finally {
    lock.releaseLock();
  }
}

function queryLaozuEventArchive_(query) {
  const guildId = String(query.guildId || "");
  const requesterId = String(query.requesterId || "");
  const userIds = (query.userIds || []).map(String);
  const limit = Math.min(12, Math.max(1, Number(query.limit) || 5));
  if (!guildId || !requesterId || userIds.indexOf(requesterId) < 0) throw new Error("查詢身分錯誤");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LAOZU_EVENT_ARCHIVE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, LAOZU_EVENT_ARCHIVE_HEADERS.length).getValues();
  return rows.reverse().filter(function(row) {
    if (String(row[1]) !== guildId) return false;
    const actorId = String(row[3]);
    const participants = String(row[4] || "").split(",").filter(Boolean);
    const scope = String(row[10] || "public");
    if (scope === "private") return actorId === requesterId;
    return userIds.indexOf(actorId) >= 0 || participants.some(function(id) { return userIds.indexOf(id) >= 0; });
  }).slice(0, limit).map(function(row) {
    let observations = {};
    try { observations = JSON.parse(String(row[11] || "{}")); } catch (_) {}
    return { id: String(row[0]), guildId: String(row[1]), channelId: String(row[2]), actorId: String(row[3]), participantIds: String(row[4] || "").split(",").filter(Boolean), text: String(row[5]), source: String(row[6]), verification: String(row[7]), createdAt: String(row[8]), scope: String(row[10] || "public"), observations: observations };
  });
}

function constantTimeEqualLaozuArchive_(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function jsonLaozuEventArchiveResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
