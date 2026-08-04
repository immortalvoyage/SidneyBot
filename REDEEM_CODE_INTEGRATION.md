# 老祖兌換碼公告整合

Worker 接收 Google Apps Script 的 HMAC-SHA256 簽章事件，驗證五分鐘時效與批次 ID，使用 KV 防止重送，再由既有 Discord Bot 發布公告並寫入 Audit Log。

## 部署設定

```powershell
wrangler secret put REDEEM_TRACKER_SECRET
npm run deploy
```

部署前在 `wrangler.jsonc` 將 `REDEEM_CODE_CHANNEL_ID` 設為正式公告頻道 ID。`REDEEM_TRACKER_SECRET` 必須是至少 32 字元的隨機值，且與 Apps Script 的 Script Properties 相同。既有 `DISCORD_BOT_TOKEN` Secret 會繼續沿用。

本模組沒有新增 Slash Command，因此不需要重新註冊指令。
