☯【仙遊者】☯ AI 管家 v3 安裝說明
================================

一、先備份原本專案。

二、將壓縮檔內以下檔案放到：
C:\Users\sidney\DiscordBot

直接覆蓋：
- commands.js
- discord.js
- gemini.js
- memory.js
- register-commands.js

三、以下現有檔案請保留，不要覆蓋：
- config.js
  請保留目前已經成功運作的 Gemini 模型名稱。
- worker.js
- utils.js
- logger.js
- wrangler.jsonc
- package.json

四、確認 wrangler.jsonc 仍包含：
"kv_namespaces": [
  {
    "binding": "BOT_MEMORY",
    "id": "你的 KV ID",
    "remote": true
  }
]

五、重新註冊指令：
node register-commands.js

六、重新部署：
npx wrangler deploy

七、預期效果：
- /ai：公開，頻道所有成員可見
- /help：公開
- /profile：只有自己可見
- /forget：只有自己可見

八、測試：
/ai question:請記住，我叫凜冬皓月
/profile
/ai question:我叫什麼名字？

若 Discord 顯示「命令已過期」，請執行：
npx wrangler tail

再立即測試 /ai，並保留終端機中的完整錯誤。
