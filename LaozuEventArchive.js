const LAOZU_EVENT_ARCHIVE_SHEET = "老祖事件記憶";
const LAOZU_EVENT_ARCHIVE_HEADERS = ["事件ID", "伺服器ID", "頻道ID", "敘述者ID", "相關玩家ID", "事件內容", "來源", "查證狀態", "事件時間", "歸檔時間"];

function doPost(e) {
  try {
    const request = JSON.parse(String(e && e.postData && e.postData.contents || "{}"));
    validateLaozuEventArchiveRequest_(request);
    const result = appendLaozuEventArchive_(request.event);
    return jsonLaozuEventArchiveResponse_({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    console.error("老祖事件歸檔失敗", error);
    return jsonLaozuEventArchiveResponse_({ ok: false, error: String(error.message || error) });
  }
}

function validateLaozuEventArchiveRequest_(request) {
  const secret = PropertiesService.getScriptProperties().getProperty("LAOZU_EVENT_ARCHIVE_SECRET");
  if (!secret) throw new Error("缺少 LAOZU_EVENT_ARCHIVE_SECRET");
  const timestamp = String(request.timestamp || "");
  const eventId = String(request.eventId || "");
  const signature = String(request.signature || "").toLowerCase();
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("請求已過期");
  if (!eventId || !request.event || request.event.id !== eventId) throw new Error("事件格式錯誤");
  const content = timestamp + "." + eventId + "." + JSON.stringify(request.event);
  const expected = Utilities.computeHmacSha256Signature(content, secret).map(function(byte) {
    return (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0");
  }).join("");
  if (!constantTimeEqualLaozuArchive_(expected, signature)) throw new Error("簽章錯誤");
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
    sheet.appendRow([eventId, String(event.guildId || ""), String(event.channelId || ""), String(event.actorId || ""), (event.participantIds || []).join(","), String(event.text || ""), String(event.source || ""), String(event.verification || ""), String(event.createdAt || ""), new Date()]);
    return { duplicate: false };
  } finally {
    lock.releaseLock();
  }
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
