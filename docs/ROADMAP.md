# ImmortalVoyage Platform V1.0 Roadmap

更新日期：2026-08-07

## 目前優先順序

1. 老祖 AI：加速人格、可信回答、記憶、心境與成員媒合整合。
2. Discord：完成管理、成員、遊戲資料及老祖互動的正式環境驗證。
3. Apps Script：維持兌換碼與既有資料流程，逐步統一平台 API。
4. Cloudflare：承載 Discord Worker、KV 與安全 API。

## 網站（暫停開發，保留於 V1.0）

- 狀態：依宗主指示暫停，不從 V1.0 移除。
- 原始碼：必須存放於 ImmortalVoyage 的 GitHub 儲存庫，以 Git 保存完整版本歷史。
- 架站方向：使用 Google 資源；預定以 Firebase Hosting 作為靜態／前端託管，必要的 Google Apps Script 或 Google Cloud 服務透過 API 串接。
- 安全：API Key、Token、Secret、Password、Webhook 不得提交至 Git，僅使用 Secrets、環境變數或 PropertiesService。
- 恢復條件：老祖 AI 與核心 Discord 流程達到 V1.0 可用標準後，再建立或移轉網站程式碼儲存庫與部署流程。

## 老祖 AI 近期里程碑

- [x] 固定人格、情緒、慎重模式與事實邊界。
- [x] 萬象錄關係狀態、每日請安與私人對話記憶。
- [x] 自願公開協助資料、明確同意、需求媒合與隨時撤回。
- [ ] 門派、主武學、副武學等遊戲角色資料（與現實需求媒合分離）。
- [x] 私人媒合邀請／接受／婉拒／雙方查詢；沒有雙方同意前不得視為媒合成立。
- [x] 媒合邀請的 Discord 私訊通知與接受／婉拒按鈕；私訊關閉時保留指令回覆備援。
- [ ] 以實際平台資料回答兌換碼、名冊與遊戲狀態，不得捏造。
