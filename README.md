# ☯【仙遊者】☯ Discord AI Bot V4.3.21

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
- `/help topic:<功能分類>`
- `/game bind|status|pending|approve|reject`
- `/audit recent|view`
- `/laozu reprimand player:<玩家> affection:<1～5> reason:<原因>`
- `/system check|repair`

## 宗門權限

- 外人：可使用 `/help`、`/profile view`、`/forget`、`/apply`
- 領民：已加入仙遊者但尚未完成《燕雲十六聲》UID 綁定，可使用成員功能並提交綁定
- 門徒：已完成《燕雲十六聲》UID 綁定，包含領民權限
- 長老：管理層，包含門徒權限，可審核入宗與遊戲綁定申請
- 宗主：完整權限，可查詢、升降階及移除成員；`SECT_MASTER_ID` 第一次互動時自動建立宗主名冊
- 指令授權以即時 KV 名冊為準，不信任殘留的 Discord 身分組
- `/help` 預設只顯示目前身分最常用的入口；完整功能依基本、遊戲、審核、宗主管理與系統維護分類查看
- `/help` 依即時 KV 身分授權分類，低階玩家不能讀取高階管理說明
- 正式成員可用 `/profile set-name` 修改仙遊者名冊顯示名稱；不會修改 Discord 或遊戲角色名稱
- `/game approve`、`/game reject` 只顯示 KV 中仍待審且仍是正式成員的申請者
- `/audit` 只允許宗主私密查看最近操作紀錄與單筆詳情
- `/laozu reprimand` 只允許宗主公開訓誡單一正式成員；程式明確扣除 1～5 點好感並寫入 Audit，AI 不得自行決定處罰
- `/system check` 只讀檢查名冊、申請、Audit 與待審遊戲綁定索引；`/system repair` 經確認後只重建索引，不刪除實體資料
- `/members` 使用宗主、長老、門徒、領民分組排版，每頁最多顯示 10 人；總覽隱藏 Discord ID，並提供按鈕翻頁、查找玩家及重新整理
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

# SidneyBot v4.3.10 申請權限與 Help 清單

- `@everyone`：可使用 `/apply` 申請加入仙遊者；核准後成為領民。
- 領民：可使用 `/game bind` 申請綁定 UID；核准後自動成為門徒。
- 門徒：已完成 UID 綁定，不再顯示或允許重複使用 `/game bind`。
- 長老：可使用 `/review` 與 `/game review` 審核申請。
- 宗主：可使用 `/member set-rank` 將已綁定 UID 的門徒晉升為長老。
- `/help` 只列出呼叫者目前有權使用的指令，玩家可見說明一律使用英文 Slash 指令名稱。

# SidneyBot v4.3.11 Discord 指令權限修正

- 所有 Slash Commands 在 Discord 註冊層不要求內建管理權限，實際權限由 Worker 依宗門身分判斷。
- 領民可呼叫 `/game bind` 提交 UID 與角色名稱；核准後自動升為門徒。
- 本版修改了 Discord 指令註冊資料，部署時必須依序執行 `npm run register` 與 `npm run deploy`。
- 若 Discord 伺服器的「整合 → 老祖 Bot → 指令」曾由管理者手動限制 `/game`，仍須在 Discord 設定中將該手動覆寫恢復為所有成員可用。

# SidneyBot v4.3.13 宗主手機管理面板

宗主可在私人頻道 `1534238116099919933` 執行一次 `/panel` 建立手機管理面板。面板支援新增領民、主動綁定 UID 並升為門徒、晉升長老、退出百業降為領民、查看玩家、軟移出名冊與最近操作紀錄。降階或移出時保留 UID 與歷史資料。

## v4.3.12 UID 綁定按鈕審核

- 領民提交 `/game bind` 後，申請卡會送到 `APPLICATION_REVIEW_CHANNEL_ID`。
- UID 申請卡提供「同意 UID 綁定」與「拒絕 UID 綁定」按鈕。
- 宗主或長老可按鈕審核；核准後領民自動升為門徒並同步 Discord 身分組。
- 完成審核後停用原按鈕並記錄審核人與時間。
- `/game review` 保留為備援審核方式。
## v4.3.14 新增領民候選人過濾

- 「新增領民」只顯示尚未持有領民、門徒或長老身分組的真人成員，並排除宗主與 Bot。
- 每頁最多 25 人，可用上一頁／下一頁切換。
- 候選名單載入與新增操作會先回覆 Discord，避免手機端顯示「未及時回應」。
- 此功能需要在 Discord Developer Portal 為 Bot 開啟 **Server Members Intent**，否則 Discord 不允許 Bot 讀取完整伺服器成員名單。

## v4.3.15 主動 UID 綁定回覆修正

- 宗主送出 UID Modal 後會立即回覆 Discord，再於背景完成綁定與晉升，避免顯示「出問題了，再試一次」。
- UID 已寫入但身分組同步失敗時，會明確顯示部分完成狀態，不會把成功綁定誤報為整體失敗。

## v4.3.17 名冊介面與手機排版優化

- 名冊依身分分組，以獨立名稱列呈現並隱藏 Discord ID。
- 每頁 10 人，提供上一頁、下一頁、查找玩家及重新整理按鈕。
- 玩家 UID 與遊戲名稱只在查找後的個人資料畫面顯示。

## v4.3.18 管理面板與萬象錄補建修正

- 沒有合格候選人時，宗主管理面板顯示合法且停用的提示選單，不再送出 Discord 不接受的 `max_values: 0`。
- 舊名冊成員缺少萬象錄時，首次請安或查看個人資料會自動補建預設資料。
- 補建只適用於仍在仙遊者名冊內的正式成員；既有萬象錄的好感、信任與請安紀錄不會被覆蓋。

## v4.3.16 宗主管理候選名單一致性

- 主動綁定 UID 只顯示尚未綁定 UID 的領民；已是門徒、長老、宗主或保留既有 UID 的領民不再出現。
- 晉升長老只顯示已綁定 UID 的門徒；退出百業只顯示門徒與長老。
- 查看與移出名冊也改用 KV 名冊候選選單，所有動作均支援超過 25 人翻頁並在送出時再次驗證資格。
- 玩家私訊失敗不會覆蓋核心綁定結果。
- 同一玩家已成功綁定時可安全重送，系統只回報既有狀態，不會重複寫入。
