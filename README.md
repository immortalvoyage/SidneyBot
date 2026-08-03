# ☯【仙遊者】☯ Discord AI Bot V4.2.11

完整獨立版，使用：

- Cloudflare Workers
- Discord Interactions / Slash Commands
- Google Gemini API
- Cloudflare KV
- 宗門申請、審核、名冊、權限、Audit Log
- 個人資料與多輪聊天記憶

## 已完成指令

- `/ai question:<問題>`
- `/apply reason:<理由>`
- `/approve applicant:<待審申請者> note:<備註>`
- `/reject applicant:<待審申請者> note:<備註>`
- `/member get player:<名冊玩家>`
- `/member set-rank player:<名冊玩家> rank:<弟子或長老>`
- `/member remove player:<名冊玩家> confirm:<確認移除>`
- `/members`
- `/sect`
- `/profile`
- `/forget`
- `/help`

## 宗門權限

- 外人：可使用 `/apply`
- 弟子：可使用 `/ai`、`/sect`、`/members`
- 長老：包含弟子權限，可批准／拒絕申請
- 宗主：完整權限；`SECT_MASTER_ID` 第一次互動時自動建立宗主名冊
- 指令授權以即時 KV 名冊為準，不信任殘留的 Discord 身分組

## 1. 安裝

```bash
npm install
```

## 2. 建立 Wrangler 設定

複製：

```bash
cp wrangler.jsonc.example wrangler.jsonc
```

填入 KV namespace ID：

```bash
npx wrangler kv namespace create BOT_MEMORY
```

將回傳的 ID 放入 `wrangler.jsonc`。

## 3. 設定 Secrets

```bash
npx wrangler secret put DISCORD_PUBLIC_KEY
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put GEMINI_API_KEY
```

`DISCORD_PUBLIC_KEY` 可在 Discord Developer Portal 的 General Information 找到。

## 4. 設定宗主

在 `wrangler.jsonc` 的 `vars` 設定：

```json
{
  "SECT_MASTER_ID": "你的 Discord User ID",
  "SECT_NAME": "☯【仙遊者】☯"
}
```

## 5. 語法檢查

```bash
npm run check
```

## 6. 部署

```bash
npm run deploy
```

部署完成後，把 Worker URL 填入 Discord Developer Portal：

`General Information → Interactions Endpoint URL`

## 7. 註冊 Slash Commands

Windows PowerShell：

```powershell
$env:DISCORD_APPLICATION_ID="你的 Application ID"
$env:DISCORD_BOT_TOKEN="你的 Bot Token"
$env:DISCORD_GUILD_ID="測試伺服器 Guild ID"
npm run register
```

測試期間建議設定 `DISCORD_GUILD_ID`，指令通常會較快出現。

要註冊為全域指令，移除 `DISCORD_GUILD_ID` 後再執行。

## 8. 建議測試順序

1. 宗主執行 `/sect`
2. 一般帳號執行 `/ai`，應被拒絕
3. 一般帳號執行 `/apply`
4. 宗主執行 `/approve applicant:<從待審選單選擇>`
5. 申請者執行 `/ai`
6. 執行 `/members`
7. 執行 `/profile`
8. 執行 `/forget`

## KV Key 結構

- `sect:member-index`
- `sect:member:<userId>`
- `sect:application-index`
- `sect:application:<userId>`
- `sect:audit-index`
- `sect:audit:<auditId>`
- `history:<guildId>:<userId>`
- `profile:<guildId>:<userId>`

## 安全注意事項

- 不要把 Bot Token、Gemini API Key 或 Discord Public Key 寫進 Git。
- `wrangler.jsonc` 可保存非機密 vars；機密一律使用 `wrangler secret put`。
- `/approve`、`/reject` 與 `/member` 管理指令使用 KV 自動完成選單。
# 入宗申請審核通知

在 `wrangler.jsonc` 的 `vars` 填入只供宗主／長老查看的 Discord 頻道 ID：

```jsonc
"APPLICATION_REVIEW_CHANNEL_ID": "你的審核頻道 ID",
"DISCORD_DISCIPLE_ROLE_ID": "弟子身分組 ID",
"DISCORD_ELDER_ROLE_ID": "長老身分組 ID"
```

Worker 需要 Discord Bot Token 才能主動發送審核通知。Token 必須使用 Cloudflare Secret，不可寫入 GitHub：

```powershell
npx wrangler secret put DISCORD_BOT_TOKEN
```

完成後重新部署 Worker 並註冊 Slash Commands。玩家執行 `/apply` 後，審核頻道會收到通知；宗主或長老可在 `/approve applicant:`、`/reject applicant:` 直接搜尋 KV 待審申請。

## Discord 身分組同步

老祖 Bot 的 Discord 身分組必須位於「弟子」與「長老」之上，並具有「管理身分組」權限。

- `/approve`：授予弟子，撤銷長老
- `/member set-rank`：依 KV 新身分切換弟子／長老
- `/member remove`：撤銷弟子與長老，保留玩家其他身分組
- Discord 同步失敗時不會繼續修改 KV，指令會回報錯誤
