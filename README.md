# SidneyBot

☯【仙遊者】☯ Discord Gemini AI Bot

## 專案簡介

SidneyBot 是部署於 Cloudflare Workers 的 Discord AI 機器人，使用 Google Gemini API 產生回覆，並透過 Cloudflare KV 保存對話與使用者資料。

AI 人格名稱：**老祖**

## 主要功能

- Discord Slash Commands
- Google Gemini AI 回覆
- Cloudflare KV 短期與長期記憶
- 使用者 Profile
- 忘記對話資料
- 繁體中文回覆
- Gemini 503 錯誤重試機制

## 指令

- `/ai`：公開向老祖提問
- `/help`：公開顯示說明
- `/profile`：私人查看個人資料
- `/forget`：私人清除記憶

## 技術架構

- Cloudflare Workers
- Discord Interactions API
- Google Gemini REST API
- Cloudflare KV
- JavaScript / Node.js
- Wrangler

## 安裝

```powershell
npm install
```

登入 Cloudflare：

```powershell
npx wrangler login
```

## 設定秘密金鑰

請勿把 API Key 或 Token 寫入 GitHub。

```powershell
npx wrangler secret put GEMINI_API_KEY
```

其他秘密金鑰也應使用 Wrangler Secret 管理。

## 部署

```powershell
npx wrangler deploy
```

## 註冊 Discord 指令

```powershell
node register-commands.js
```

## GitHub 更新流程

每次修改並存檔後：

1. 在 GitHub Desktop 查看 **Changes**
2. 在 **Summary** 填寫修改摘要
3. 按 **Commit to main**
4. 按 **Push origin**

## 安全注意事項

以下內容不可提交到 GitHub：

- Gemini API Key
- Discord Bot Token
- Cloudflare API Token
- `.env`
- `.dev.vars`
- `.wrangler`
- `node_modules`

`wrangler.jsonc` 可以提交，但不要直接放入秘密金鑰。

## 專案位置

```text
D:\Sidney\AiBot\SidneyBot
```
