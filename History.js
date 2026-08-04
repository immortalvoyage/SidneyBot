/**************************************************
 * History.gs
 **************************************************/

function updateHistory(active,expired){

  const sheet =
      SpreadsheetApp.getActive()
      .getSheetByName(CONFIG.SHEETS.HISTORY);

  if(sheet.getLastRow()==0){

      sheet.appendRow([
          "Code",
          "狀態",
          "Added",
          "Verified",
          "Expired"
      ]);

  }

  const map={};

  if(sheet.getLastRow()>1){

      const values=sheet
      .getRange(
          2,
          1,
          sheet.getLastRow()-1,
          5
      )
      .getValues();

      values.forEach(r=>{

          map[r[0]]=true;

      });

  }

  const rows=[];

  active.forEach(c=>{

      if(!map[c.code]){

          rows.push([
              c.code,
              "ACTIVE",
              c.addedAt,
              c.verifiedAt,
              ""
          ]);

      }

  });

  expired.forEach(c=>{

      if(!map[c.code]){

          rows.push([
              c.code,
              "EXPIRED",
              c.addedAt,
              c.verifiedAt,
              c.expiredAt
          ]);

      }

  });

  if(rows.length){

      sheet
      .getRange(
          sheet.getLastRow()+1,
          1,
          rows.length,
          5
      )
      .setValues(rows);

  }

}
