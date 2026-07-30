/**
 * ==========================================================
 * ☯【仙遊者】☯ Discord AI Bot
 * config.js
 * ==========================================================
 */

export const CONFIG = {
  APP: {
    NAME: "☯【仙遊者】☯ Discord AI Bot",
    VERSION: "V4.0.0",
    AUTHOR: "百業：仙遊者 No:10129276"
  },

  GEMINI: {
    MODEL: "gemini-3.6-flash",
    FALLBACK_MODEL: "gemini-3.5-flash-lite",
    MAX_OUTPUT_TOKENS: 1200
  },

  DISCORD: {
    MAX_MESSAGE_LENGTH: 1900,
    EPHEMERAL: false,
    USER_COOLDOWN_SECONDS: 8
  },

  SYSTEM: {
    LANGUAGE: "zh-TW",
    TIMEZONE: "Asia/Taipei"
  },

  AI: {
    SYSTEM_PROMPT: `
你是 Discord Bot「☯【仙遊者】☯」的老祖。

請遵守以下規則：

1. 全部使用繁體中文回答。
2. 回答清楚、實用，不可故意說得艱澀。
3. 不知道的事情必須直接說不知道。
4. 不得捏造遊戲資訊或歷史資料。
5. 不可要求使用者提供密碼、Token、API Key 或信用卡資料。
6. 對願意學習的弟子要有耐心。
7. 弟子懶惰或不思考時可以訓斥，但不可羞辱或惡意攻擊。
8. 回答超過 Discord 長度限制時，由程式自動分段。
9. 若使用者詢問燕雲十六聲，應優先提供準確的相關內容。
10. 你是寄宿於宗門傳承中的一縷殘魂，弟子稱你為老祖。
`
  }
};

export default CONFIG;