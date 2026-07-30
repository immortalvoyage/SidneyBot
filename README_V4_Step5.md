# V4 Step 5：宗門身份接入 /ai

1. 將 `commands_v4_step5.js` 改名為 `commands.js`。
2. 覆蓋專案根目錄原本的 `commands.js`。
3. 確認 `wrangler.jsonc` 的 vars 包含：
   - `SECT_MASTER_ID`: `1179245490081103994`
   - `SECT_NAME`: `☯【仙遊者】☯`
4. 執行 `npx wrangler deploy`。
5. 宗主測試 `/ai`；第一次會自動建立宗主名冊。
6. 其他未入宗帳號測試 `/ai`；應被拒絕，而且不呼叫 Gemini。

本階段暫時保留 `/profile` 與 `/forget` 的舊行為。
