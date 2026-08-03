# Changelog

## 4.2.11

- Added Discord disciple/elder role synchronization to application approval, rank changes, and member removal.
- Role updates preserve unrelated Discord roles and replace only the two managed 仙遊者 roles.
- KV mutations stop when Discord role synchronization fails, preventing stale elder access after removal.
- Audit records now include Discord role synchronization results.
- Added lifecycle regression tests for promotion, removal, role preservation, and Discord API failures.

## 4.2.9

- Replaced Discord user pickers in `/member get`, `/member set-rank`, and `/member remove` with autocomplete sourced from the 仙遊者 KV roster.
- Added protected autocomplete interaction routing with name, username, and Discord ID search.
- Added `/member get` for the sect master to inspect member identity, join time, and approved 燕雲 UID binding status.
- Excluded the protected sect master from rank-change and removal suggestions.
- Added offline tests for autocomplete filtering, authorization, roster scope, member lookup, and game binding display.

## 4.2.8

- Added `/member remove` for the sect master to remove disciples or elders from the member roster.
- Added an explicit confirmation choice and protection against removing the configured sect master.
- Preserved game UID bindings and historical game data when a member is removed.
- Added `member.removed` audit records with the former rank, display name, preservation policy, and optional note.
- Added offline tests for permissions, confirmation, master protection, member removal, binding preservation, and audit logging.

## 4.2.7

- Added `/member set-rank` for the sect master to promote disciples or demote elders.
- Protected the configured sect master and the master rank from modification.
- Added `member.rank_changed` audit records with the old rank, new rank, and optional note.
- Added offline tests for permissions, master protection, validation, persistence, and audit logging.

## V4.2.3

- 新增完整宗門會員系統
- 新增入宗申請、批准、拒絕流程
- 新增宗主與長老審核權限
- 新增宗門名冊與個人宗門狀態
- 新增 Audit Log
- Gemini System Prompt 接入真實宗門身分
- `/ai` 改為只允許弟子、長老、宗主使用
- 宗主首次互動自動建立名冊
- 保留並整合個人資料、多輪記憶與 `/forget`
- Discord API 回覆加入分段與重試
- Gemini 加入逾時、模型 fallback、重試
- 加入語法檢查工具

## 4.2.5-hotfix-1
- Replaced the local Discord setup PowerShell script with an ASCII-only version for Windows PowerShell 5.1 compatibility.

## 4.2.6
- `/game approve` and `/game reject` now use a Discord member picker instead of requiring a manually copied user ID.
- `/game pending` now displays the Discord mention, Discord ID, UID, and character name.
- `/help` now lists all currently registered commands, including every `/game` subcommand.
# v4.2.10

- `/approve` 與 `/reject` 改用 KV 待審入宗申請 autocomplete，無須手動輸入 Discord ID。
- `/apply` 成功後可透過 `APPLICATION_REVIEW_CHANNEL_ID` 通知指定審核頻道。
- 審核通知失敗只寫入錯誤紀錄，不影響已保存的申請。
