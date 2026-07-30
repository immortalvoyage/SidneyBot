☯【仙遊者】☯ Gemini 503 修正包

請覆蓋專案根目錄中的：
- gemini.js
- commands.js
- config.js

本修正：
1. 不再把所有錯誤硬寫成 503。
2. 主模型固定為 gemini-2.5-flash。
3. 備援模型為 gemini-2.5-flash-lite。
4. 每次重試使用獨立 45 秒逾時。
5. 429、401、403、404、5xx 顯示不同錯誤。
6. 1、2、4 秒指數退避並加入 jitter。

部署：
npx wrangler deploy

查看即時紀錄：
npx wrangler tail
