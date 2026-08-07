# 老祖事件記憶 Google Sheets 歸檔設定

## 架構

- Cloudflare KV：保留 30 天事件與玩家索引，供聊天低延遲查詢。
- Google Sheets：長期保存可調閱事件；Apps Script 以事件 ID 去重。
- Google Drive：保存試算表、規格與必要證據，不將每筆事件另存成大量檔案。

## 必要設定

1. 在目前 Apps Script 專案的「專案設定 → 指令碼屬性」新增 `LAOZU_EVENT_ARCHIVE_SECRET`。
2. 將 Apps Script 部署為網頁應用程式，執行身分選擇部署者，存取權限選擇允許 Cloudflare 呼叫的範圍。
3. 將部署後 `/exec` URL 設為 Cloudflare Secret `LAOZU_EVENT_ARCHIVE_URL`。
4. 將相同密鑰設為 Cloudflare Secret `LAOZU_EVENT_ARCHIVE_SECRET`；不得寫入 Git 或一般文件。
5. 重新部署 Apps Script 與 Cloudflare Worker，再用公開頻道的跨玩家 `@老祖` 訊息驗證。

## 正確結果

試算表會自動出現「老祖事件記憶」分頁，包含事件 ID、伺服器、頻道、敘述者、相關玩家、內容、來源、查證狀態與時間。重送相同事件不會新增第二列。

## 後續擴充判斷

- 資料量小、需人工調閱：維持 Google Sheets。
- 資料量大、需統計分析：再同步至 BigQuery。
- 需要語意搜尋與文件知識檢索：評估 Vertex AI Search／向量索引，不直接讓聊天逐列掃描試算表。
