/**************************************************
 * Trigger.gs
 **************************************************/

function createHourlyTrigger(){

  deleteTriggers();

  ScriptApp.newTrigger("updateAll")
    .timeBased()
    .everyHours(1)
    .create();

  SpreadsheetApp.getUi().alert(
    "已建立每小時自動更新。"
  );

}


/**************************************************
 * 函式：deleteTriggers
 *
 * 說明：此函式為系統模組的公開或內部處理程序。
 **************************************************/
function deleteTriggers(){

  const triggers=ScriptApp.getProjectTriggers();

  triggers.forEach(t=>{

    ScriptApp.deleteTrigger(t);

  });

}
