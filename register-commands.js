/**
 * ☯【仙遊者】☯ AI 管家 v3
 * 註冊 Discord Slash Commands
 */

const APPLICATION_ID =
  process.env.DISCORD_APPLICATION_ID;

const BOT_TOKEN =
  process.env.DISCORD_BOT_TOKEN;

const COMMANDS = [
  {
    name: "ai",
    description: "公開向老祖提問",
    options: [
      {
        name: "question",
        description: "請輸入問題",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "profile",
    description: "私密查看 AI 記住的個人資料"
  },
  {
    name: "forget",
    description: "私密清除自己的聊天與個人記憶"
  },
  {
    name: "help",
    description: "公開查看 Bot 使用說明"
  }
];

async function registerCommands() {
  if (!APPLICATION_ID || !BOT_TOKEN) {
    console.error(
      "❌ 缺少 DISCORD_APPLICATION_ID 或 DISCORD_BOT_TOKEN"
    );

    process.exit(1);
  }

  const url =
    `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization:
        `Bot ${BOT_TOKEN}`,
      "Content-Type":
        "application/json"
    },
    body: JSON.stringify(COMMANDS)
  });

  if (!response.ok) {
    console.error(
      "❌ Discord Commands 註冊失敗",
      await response.text()
    );

    process.exit(1);
  }

  console.log(
    "✅ Slash Commands 完成：/ai /profile /forget /help"
  );
}

registerCommands();
