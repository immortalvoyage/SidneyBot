# Changelog

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
