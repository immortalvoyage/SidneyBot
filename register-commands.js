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
        required: true,
        max_length: 1800
      }
    ]
  },
  {
    name: "apply",
    description: "私密申請加入宗門",
    options: [
      {
        name: "reason",
        description: "申請理由",
        type: 3,
        required: false,
        max_length: 500
      }
    ]
  },
  {
    name: "approve",
    description: "私密批准入宗申請（宗主／長老）",
    options: [
      {
        name: "user_id",
        description: "申請者 Discord User ID",
        type: 3,
        required: true
      },
      {
        name: "note",
        description: "審核備註",
        type: 3,
        required: false,
        max_length: 500
      }
    ]
  },
  {
    name: "reject",
    description: "私密拒絕入宗申請（宗主／長老）",
    options: [
      {
        name: "user_id",
        description: "申請者 Discord User ID",
        type: 3,
        required: true
      },
      {
        name: "note",
        description: "拒絕原因或備註",
        type: 3,
        required: false,
        max_length: 500
      }
    ]
  },
  {
    name: "members",
    description: "私密查看宗門名冊"
  },
  {
    name: "sect",
    description: "私密查看宗門狀態"
  },
  {
    name: "profile",
    description: "私密查看個人與宗門資料"
  },
  {
    name: "forget",
    description: "私密清除自己的 AI 記憶"
  },
  {
    name: "help",
    description: "私密查看 Bot 使用說明"
  }
];

async function registerCommands() {
  if (!APPLICATION_ID || !BOT_TOKEN) {
    console.error(
      "❌ 缺少 DISCORD_APPLICATION_ID 或 DISCORD_BOT_TOKEN"
    );
    process.exit(1);
  }

  const guildId = process.env.DISCORD_GUILD_ID;

  const endpoint = guildId
    ? `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(COMMANDS)
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(
      `❌ Discord Commands 註冊失敗 HTTP ${response.status}`,
      text
    );
    process.exit(1);
  }

  console.log(
    "✅ Slash Commands 註冊完成：",
    COMMANDS.map(item => `/${item.name}`).join(" ")
  );
}

registerCommands();
