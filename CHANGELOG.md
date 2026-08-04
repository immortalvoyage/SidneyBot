# Changelog

## 4.2.18

- 耗時管理指令先回覆 Discord 私密 deferred acknowledgement，再於背景更新原訊息。
- `/approve`、`/member set-rank`、`/member remove`、`/system check`、`/system repair` 套用逾時保護。
- 背景失敗會寫入錯誤日誌並將安全錯誤訊息更新至原 Discord 回覆。
- Slash Command 結構未變更，不需要重新註冊。

## 4.2.17

- `/members` 新增可選的 `page` 頁碼參數。
- 名冊固定每頁顯示 15 人，並顯示目前頁數、總頁數與總人數。
- 超出範圍的頁碼會安全拒絕，不會回傳空白名冊。
- 名冊回覆維持私密，既有身分權限不變。

## 4.2.16

- Added master-only `/system check` and `/system repair` commands.
- Detects missing, stale, and duplicate entries across member, application, Audit, and pending game-binding indexes.
- Repair rebuilds indexes from existing KV records without deleting record data and preserves chronological ordering.
- Added `system.kv_indexes_repaired` Audit records and authorization/repair regression tests.

## 4.2.15

- Added master-only `/audit recent` and `/audit view record:<record>` commands.
- Added protected Audit autocomplete sourced from recent KV records.
- Audit output resolves current member names and preserves removed-member snapshots when available.
- Audit details expose only approved operational fields and remain ephemeral.
- Added regression tests for authorization, empty logs, missing records, formatting, and autocomplete privacy.

## 4.2.14

- Added `/profile view` and `/profile set-name name:<display name>`.
- Formal members can update only their own 仙遊者 roster display name.
- Kept roster, Discord, and game character names as independent identities.
- Added display-name validation and `member.display_name_changed` Audit records.
- Added regression tests for authorization, persistence, validation, and Audit logging.

## 4.2.13

- `/help` now reads the caller's current KV roster rank before rendering.
- Disciples see member commands only; elders additionally see review commands.
- Sect masters additionally see member lookup, rank, and removal commands.
- Outsiders see only personal help and the application command.
- Added role-specific `/help` regression tests.

## 4.2.12

- Replaced Discord member pickers in `/game approve` and `/game reject` with autocomplete sourced from pending KV binding requests.
- Added execution-time checks that a binding is still pending and its applicant is still a formal 仙遊者 member.
- Prevented already approved or rejected binding requests from being processed again.
- Hid stale game binding requests belonging to removed members from pending lists and autocomplete.
- Restricted `/sect` counts and status data to current formal members.
- Added offline regression tests for game review authorization, stale membership, duplicate review, and `/sect` information disclosure.

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
# v4.3.1

- 保留 13 組既有英文 Discord Slash Commands。
- 新增 13 組功能相同的繁體中文 Slash Commands。
- 中文指令、子指令與參數在進入既有處理器前標準化，避免維護兩套業務邏輯。
- 新增中文指令轉換測試。
# v4.3.2

- 合併入宗核准與拒絕為單一 `/review`／`/審核` 指令，依序選擇待審玩家與核准／拒絕。
- 合併 UID 綁定核准與拒絕為單一 `/game review`／`/遊戲 審核` 子指令。
- 移除 Discord 註冊清單中的 `/approve`、`/reject`、`/批准`、`/拒絕` 與對應遊戲子指令。
