# Day 2：遊戲身份核心與每週資料匯入

## 新增功能

- `/game bind uid:<UID> character_name:<角色名稱>`：玩家提交燕雲 UID 綁定。
- `/game status`：查看自己的綁定。
- `/game pending`：宗主／長老查看待審。
- `/game approve applicant:<待審綁定>`：從 KV 待審清單核准綁定。
- `/game reject applicant:<待審綁定>`：從 KV 待審清單拒絕綁定。
- `POST /api/v1/wwm/weekly-stats`：供 Google Apps Script 匯入每週資料。

## API Secret

部署前新增 Cloudflare Secret：

```powershell
npx wrangler secret put PLATFORM_API_TOKEN
```

請輸入一組長度至少 32 字元的隨機字串，並在 Apps Script 指令碼屬性保存同一組值。

## API Payload

```json
{
  "week": "2026-W31",
  "source": "google_sheets",
  "rows": [
    {
      "uid": "10129276",
      "characterName": "凜冬皓月",
      "offlineDays": 0,
      "activityScore": 5385,
      "realmClears": 3,
      "note": ""
    }
  ]
}
```

## Google Sheet 欄位

統計週｜UID｜角色名稱｜離線天數｜上週活躍度｜上週俠境通關｜備註

UID 請設定為純文字格式。
