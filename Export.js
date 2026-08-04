/**************************************************
 * Export.gs
 **************************************************/

function exportCSV(){

  const sheet=SpreadsheetApp.getActive()
    .getSheetByName(CONFIG.SHEETS.ACTIVE);

  const values=sheet.getDataRange().getValues();

  const csv=values.map(r=>

      r.join(",")

  ).join("\n");

  const file=DriveApp.createFile(

      "codes.csv",

      csv,

      MimeType.CSV

  );

  SpreadsheetApp.getUi().alert(

      "CSV 已建立\n\n"+file.getUrl()

  );

}
