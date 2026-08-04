# ☯【仙遊者】☯ Discord AI Bot V4.3.9

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
- `/member set-rank player:<名冊玩家> rank:<領民、門徒或長老>`
- `/member remove player:<名冊玩家> confirm:<確認移除>`
- `/members page:<頁碼>`
- `/sect`
- `/profile view`
- `/profile set-name name:<顯示名稱>`
- `/forget`
- `/help`
- `/game bind|status|pending|approve|reject`
- `/audit recent|view`
- `/system check|repair`

## 宗門權限

- 外人：可使用 `/help`、`/profile view`、`/forget`、`/apply`
- 領民：已加入仙遊者但尚未完成《燕雲十六聲》UID 綁定，可使用成員功能並提交綁定
- 門徒：已完成《燕雲十六聲》UID 綁定，包含領民權限
- 長老：管理層，包含門徒權限，可審核入宗與遊戲綁定申請
- 宗主：完整權限，可查詢、升降階及移除成員；`SECT_MASTER_ID` 第一次互動時自動建立宗主名冊
- 指令授權以即時 KV 名冊為準，不信任殘留的 Discord 身分組
- `/help` 依即時 KV 身分只顯示呼叫者目前可使用的指令
- 正式成員可用 `/profile set-name` 修改仙遊者名冊顯示名稱；不會修改 Discord 或遊戲角色名稱
- `/game approve`、`/game reject` 只顯示 KV 中仍待審且仍是正式成員的申請者
- `/audit` 只允許宗主私密查看最近操作紀錄與單筆詳情
- `/system check` 只讀檢查名冊、申請、Audit 與待審遊戲綁定索引；`/system repair` 經確認後只重建索引，不刪除實體資料
- `/members` 每頁最多顯示 15 人，避免名冊成長後超過 Discord 訊息限制
- `/approve`、`/member set-rank`、`/member remove`、`/system check`、`/system repair` 會先回覆私密等待狀態，再於背景更新結果，避免 Discord 首次回覆逾時

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
7. 執行 `/profile view`
8. 執行 `/profile set-name name:凜冬皓月`，再用 `/sect` 確認名稱
9. 執行 `/forget`
10. 宗主執行 `/system check`，確認正式 KV 索引狀態
11. 執行 `/approve` 或 `/system check` 時，確認 Discord 先顯示等待狀態，完成後由原訊息更新結果

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
"DISCORD_RESIDENT_ROLE_ID": "領民身分組 ID",
"DISCORD_DISCIPLE_ROLE_ID": "門徒身分組 ID",
"DISCORD_ELDER_ROLE_ID": "長老身分組 ID"
```

Worker 需要 Discord Bot Token 才能主動發送審核通知。Token 必須使用 Cloudflare Secret，不可寫入 GitHub：

```powershell
npx wrangler secret put DISCORD_BOT_TOKEN
```

完成後重新部署 Worker 並註冊 Slash Commands。玩家執行 `/apply` 後，審核頻道會收到通知；宗主或長老可在 `/approve applicant:`、`/reject applicant:` 直接搜尋 KV 待審申請。

## Discord 身分組同步

老祖 Bot 的 Discord 身分組必須位於「領民」「門徒」「長老」之上，並具有「管理身分組」權限。

- 入宗核准：授予領民
- UID 綁定核准：領民自動改為門徒
- `/member set-rank`：依 KV 新身分切換領民／門徒／長老；領民未綁定 UID 時不能升為門徒或長老
- `/member remove`：撤銷領民、門徒與長老，保留玩家其他身分組
- Discord 同步失敗時不會繼續修改 KV，指令會回報錯誤
- 耗時管理操作已採 Discord deferred 回覆；本版本沒有修改 Slash Command 結構，從 V4.2.17 更新時不必重新註冊
# SidneyBot v4.3.8 身分組與 UID 規則

本版新增老祖每日請安面板與入宗審核按鈕。玩家每日只需點擊「向老祖請安」；宗主或長老可在指定頻道執行一次 `/panel` 或 `/面板` 建立長期面板。新入宗申請會自動送至既有審核頻道並附上「同意入宗」與「拒絕申請」按鈕，原 `/review`／`/審核` 保留作為備援。

部署本版前必須設定 `DISCORD_RESIDENT_ROLE_ID`，並重新執行 `npm run register` 後再執行 `npm run deploy`。不需新增或修改任何 Secret。

# SidneyBot v4.3.9 萬象錄對話整合

老祖對話現在會讀取程式實際保存的好感、信任、記仇與每日請安摘要。這些資料只影響語氣與互動意願，AI 不得自行修改分數、捏造原因或繞過宗門權限。`/profile view`／`/個人資料 查看` 亦會顯示本人可見的好感、信任與請安摘要。
