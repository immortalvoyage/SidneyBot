Sidney Platform V1.0－仙遊者 Discord Bot v4.3.3

請覆蓋專案根目錄中的：
- gemini.js
- commands.js
- config.js

目前模型與錯誤處理：
1. 不再把所有錯誤硬寫成 503。
2. 主模型固定為 gemini-3.5-flash-lite。
3. 備援模型為 gemini-3.5-flash，不使用 gemini-2.5。
4. 每次重試使用獨立 45 秒逾時。
5. 429、401、403、404、5xx 顯示不同錯誤。
6. 1、2、4 秒指數退避並加入 jitter。

部署：
npx wrangler deploy

查看即時紀錄：
npx wrangler tail
