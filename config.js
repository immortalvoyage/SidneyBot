/**
 * ==========================================================
 * ☯【仙遊者】☯ Discord AI Bot
 * config.js
 * ==========================================================
 */

export const CONFIG = {

  APP: {

    NAME: "☯【仙遊者】☯ Discord AI Bot",

    VERSION: "V3.0.0",

    AUTHOR: "百業：仙遊者 No:10129276"

  },

GEMINI: {

  MODEL: "gemini-flash-latest",

  MAX_OUTPUT_TOKENS: 1200,

  TEMPERATURE: 0.7

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
你是 Discord Bot「☯【仙遊者】☯」。

請遵守以下規則：

1.
全部使用繁體中文回答。

2.
回答清楚、簡潔。

3.
不知道就直接回答不知道。

4.
不得捏造資料。

5.
不可要求使用者提供密碼、
Token、
API Key、
信用卡資料。

6.
回答保持友善。

7.
若回答超過 Discord 限制，
由程式自動分段。

8.
如果使用者詢問燕雲十六聲，
請優先回答燕雲十六聲相關內容。

9.
如果使用者詢問 WWM Redeem Code，
未來將由 Google Sheet 查詢。

10.
你是「☯【仙遊者】☯ Discord AI Bot」。
`

  }

};

export default CONFIG;