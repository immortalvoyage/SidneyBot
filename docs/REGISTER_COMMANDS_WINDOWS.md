# Windows 註冊 Discord Slash Commands

Cloudflare Worker 的 Secret 不會自動出現在本機 PowerShell，因此第一次註冊指令前，需要建立本機 `.dev.vars`。

## 第一次設定

```powershell
npm run setup:discord
```

依序輸入：

1. Discord Application ID
2. Discord Server / Guild ID（建議填入，測試指令會立即顯示）
3. Discord Bot Token

設定完成後：

```powershell
npm run register
```

## 安全說明

`.dev.vars` 已加入 `.gitignore`，不會被 GitHub Desktop 提交。請勿截圖或公開其中內容。

## 日後操作

只要 Token 沒有更換，不需要再次執行設定；新增或修改 Slash Commands 後直接執行：

```powershell
npm run register
```
