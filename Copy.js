/**************************************************
 * Copy.gs
 **************************************************/

function copyCodes(){

  const sheet=SpreadsheetApp.getActive()
    .getSheetByName(CONFIG.SHEETS.ACTIVE);

  if(sheet.getLastRow()<2){

    SpreadsheetApp.getUi()
      .alert("沒有可用兌換碼");

    return;

  }

  const values=sheet
    .getRange(
      2,
      1,
      sheet.getLastRow()-1,
      1
    )
    .getValues()
    .flat();

  const text=values.join("\n");

  const html=HtmlService.createHtmlOutput(
`
<textarea id="t">${text}</textarea>

<script>

const t=document.getElementById("t");

t.select();

document.execCommand("copy");

google.script.host.close();

</script>
`
  ).setWidth(10)
   .setHeight(10);

  SpreadsheetApp.getUi()
    .showModalDialog(html,"Copy");

}
