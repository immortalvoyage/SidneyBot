# Changelog

- 新增老祖跨玩家事件記憶：公開頻道內同時提及老祖與其他玩家的內容會保存 30 天，供事件參與者後續對話自然承接；私人訊息不共享，未查證陳述不得當成事實。

## 4.3.22

- 新增 Discord Gateway 常駐入口，支援以 `@老祖` 自然呼叫。
- 新增 HMAC 驗證的 `/integrations/discord-mentions` Worker 端點。
- 沿用正式成員權限、30 天記憶、萬象錄與老祖五軸心情。
- 同一訊息防重送，同日有效聊天不重複灌高心情。
- `/ai` 與既有 Worker 功能維持不變，作為穩定備援。
- 新增 Worker `/healthz`，可驗證版本與整合能力是否已配置，且不輸出 Secret。
- Gateway 新增健康檢查、連線狀態、錯誤摘要與優雅關閉流程。
- 新增 `Dockerfile.gateway`，讓 `@老祖` Gateway 可部署為常駐容器。

## 4.3.21

- 新增老祖全域心情狀態：愉悅、安心、疲勞、信任與社群壓力。
- 每日請安、有效聊天、訓誡與兌換碼公告會形成防重送心情訊號。
- 新增需要 Bearer Secret 的 `/integrations/laozu-state` 私密接口，供仙遊者網站讀取。
- 心情數值會自然回歸基準，避免舊事件永久影響老祖。

## 4.3.20

- 重整 `/help` 為依身分顯示的精簡首頁，不再一次列出所有指令。
- 新增選用的 `topic` 功能分類：基本功能、遊戲綁定、審核工作、宗主管理與系統維護。
- 外人、領民、門徒、長老與宗主各自顯示目前最重要的下一步或常用入口。
- 宗主管理與系統維護從首頁收起，降低手機畫面資訊密度。
- 分類內容仍在 Worker 依即時 KV 身分授權，不能藉由選擇分類越權查看高階指令。

## 4.3.19

- 新增 `/laozu reprimand`／`/老祖 訓誡`，由宗主指定單一正式成員、1～5 點好感扣除與訓誡原因。
- 目標使用 Discord 原生玩家選項，禁止猜測姓名、處分宗主或處分非正式成員。
- 老祖公開提及目標並依宗主提供的原因生成克制、不羞辱人的訓誡；AI 無權自行決定或擴大處罰。
- 以 Discord Interaction ID 防止重送造成重複扣分，並記錄變動前後好感、原因、執行者與對象至 Audit Log。
- AI 暫時失敗時改用安全訓誡範本，已授權的分數異動仍會如實顯示。

## 4.3.18

- 修正宗主管理面板空候選選單把 `min_values`、`max_values` 設為 `0`，導致 Discord 回傳 `Invalid Form Body`。
- 空候選名單現在顯示停用選單與「目前沒有符合資格的玩家」，欄位仍維持 Discord 規定的合法值 `1`。
- 舊名冊成員缺少萬象錄時，首次請安與查看個人資料會自動補建預設玩家狀態。
- 補建流程沿用既有 `ensurePlayerState`，保留已存在的關係、請安與歷史資料。

## 4.3.16

- 將宗主管理面板所有玩家選單統一改為依 KV 名冊、身分與 UID 狀態產生候選名單。
- 主動綁定 UID 排除已綁定玩家與所有非領民，避免已成為門徒的玩家再次出現在選單。
- 晉升、退出百業、查看及移出名冊均套用操作資格過濾、翻頁與執行前二次驗證。
- 保留綁定選擇後立即開啟 Discord Modal 的互動時序，避免延遲回覆造成表單失效。

## 4.3.15

- 修正宗主主動綁定 UID 已成功寫入，Discord Modal 卻顯示失敗的錯誤狀態。
- Modal 提交改為立即 deferred 回覆，再於 Worker 背景完成綁定、晉升、身分組同步與通知。
- 將核心綁定成功、晉升／身分組同步警告與玩家私訊失敗分開顯示。
- 已綁定玩家重送相同操作時回傳既有成功狀態，不重複建立綁定。

## 4.3.12

- `/game bind` 成功後將 UID 綁定申請送至指定審核頻道。
- 新增 UID 綁定同意／拒絕按鈕與防止重複審核機制。
- 宗主與長老可核准 UID，核准後領民自動升為門徒並同步 Discord 身分組。
- 審核完成後更新原申請卡、停用按鈕並私訊玩家結果。
- 保留 `/game review` 作為備援流程。

## 4.3.11

- 明確將所有 Slash Commands 的 Discord 預設權限設為開放，由 Worker 依宗門身分授權。
- 修正領民在 Discord 註冊層無法使用 `/game bind` 的問題。
- 本版必須重新執行 `npm run register`，以覆蓋 Discord 端舊的 `/game` 指令定義。

## 4.3.10

- 明確鎖定申請流程：`@everyone` 申請入宗、領民申請 UID 綁定、宗主晉升門徒為長老。
- `/help` 依身分分開顯示申請與審核指令，且玩家可見說明只使用英文指令名稱。
- `/game bind` 執行階段限定領民；門徒、長老與宗主不再重複提交 UID 綁定。
- 宗主調整成員身分後，由老祖私訊玩家結果；長老通知列出英文審核指令。

## 4.3.9

- 老祖對話載入實際萬象錄好感、信任、記仇與請安摘要，用於調整語氣與互動意願。
- 明確禁止 AI 自行更改關係分數、捏造原因或讓好感凌駕權限與宗門規則。
- `/profile view`／`/個人資料 查看` 新增萬象錄好感、信任及請安摘要。
- 沒有萬象錄資料時明確標示缺少資料，不讓老祖自行猜測。

## 4.3.8

- 身分層級調整為宗主 ＞ 長老 ＞ 門徒 ＞ 領民 ＞ `@everyone`。
- 入宗核准後預設建立為領民，不再直接授予門徒。
- 《燕雲十六聲》UID 綁定核准後，領民自動升為門徒並同步 Discord 身分組。
- Discord 身分組同步擴充為領民、門徒、長老三個受管理身分組，保留其他身分組。
- 未綁定 UID 的領民不能手動調整為門徒或長老。
- 宗主最高管理權與長老審核權限維持不變。

## 4.3.6

- 將萬象錄玩家狀態正式接入既有 `BOT_MEMORY` KV。
- 入宗核准、宗主直接加入及宗主首次建檔時自動建立預設玩家狀態。
- 名冊顯示名稱更新時同步萬象錄名稱，不覆蓋好感、信任、請安與里程碑資料。
- 成員移除後保留萬象錄歷史資料，供未來復歸與稽核使用。

## 4.3.5

- 新增簽章保護的老祖兌換碼整合連線測試事件。
- 測試會驗證 Worker、共享密鑰、Bot Token、公告頻道與 Discord 發送權限。
- 測試訊息明確標示為非兌換碼，不寫入正式公告去重紀錄。

## 4.3.3

- 新增宗主透過 `/ai`／`/詢問` 自然語言要求老祖加入新弟子或長老。
- 從 Discord Mention 取得 User ID，並以伺服器暱稱／顯示名稱建立名冊。
- 新增成員時同步 Discord 身分組並寫入 Audit；既有成員不重複建立。
- 遊戲 UID 保持未綁定，沿用玩家自行綁定與既有宗主管理流程。
- 移除所有內建 `gemini-2.5` 備援，固定使用 3.5 系列設定。
- `wrangler.jsonc` 帶入既有非敏感 ID，避免每次更新重填。

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
# v4.3.4 - 2026-08-04

- 新增宗主透過老祖對話移除仙遊者成員。
- 入宗核准、拒絕及宗主主動加入後，由老祖私訊當事玩家。
- 加入成功私訊附上《燕雲十六聲》UID 綁定方式。
- 成員移除及 UID 綁定審核亦採相同私訊通知模式。
- 私訊失敗不回滾已完成的成員操作，並寫入 Audit Log。
# v4.3.7 - 2026-08-04

- 新增長期「老祖每日請安」面板與一鍵按鈕，玩家不需輸入指令。
- 每日請安依 `Asia/Taipei` 日期結算，同日重複點擊不重複加分。
- 萬象錄記錄請安累計、目前／最長連續天數與好感 +1（上限 100）。
- 新增 `/panel`／`/面板`，供宗主或長老在目前頻道建立請安面板。
- 入宗申請通知新增「同意入宗」與「拒絕申請」按鈕。
- 審核按鈕沿用既有權限、名冊、身分組、萬象錄、Audit 與私訊流程。
- 審核完成後更新原訊息並停用按鈕；未授權與重複操作採私人提示。
- 保留 `/review`／`/審核` 作為備援，不變動兌換碼整合與 Secrets。
# v4.3.13

- 新增宗主審批私人頻道的手機按鈕管理面板。
- 支援新增領民、宗主主動綁定 UID 並升門徒、晉升長老、退出百業降為領民、查看玩家、軟移出名冊與最近操作紀錄。
- 所有管理操作在 Worker 再次驗證宗主與指定頻道；UID 與歷史資料在降階或移出時保留。
# v4.3.14

- 宗主管理面板的「新增領民」改為候選人選單，只顯示尚未持有領民、門徒、長老身分組的真人帳號，並排除宗主與機器人。
- 候選人超過 25 人時支援上一頁／下一頁。
- 新增前再次檢查 KV 名冊與 Discord 身分組，避免舊面板或同時操作造成重複加入。
- 候選名單載入與新增領民改為先延遲回覆，避免 Discord 顯示「未及時回應」。
# v4.3.17

- 將 `/members` 改為適合手機閱讀的身分分組名冊，每頁 10 人。
- 名冊總覽隱藏 Discord ID，只顯示宗主、長老、門徒與領民名稱。
- 新增上一頁、下一頁、查找玩家與重新整理按鈕。
- 查找玩家後才顯示身分、遊戲名稱與 UID，並保留即時權限驗證。
