import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadLocalEnvironment();

const APPLICATION_ID = clean(process.env.DISCORD_APPLICATION_ID);
const BOT_TOKEN = clean(process.env.DISCORD_BOT_TOKEN);
const GUILD_ID = clean(process.env.DISCORD_GUILD_ID);

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
        name: "applicant",
        description: "從待審入宗申請搜尋玩家",
        type: 3,
        required: true,
        autocomplete: true
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
        name: "applicant",
        description: "從待審入宗申請搜尋玩家",
        type: 3,
        required: true,
        autocomplete: true
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
  { name: "members", description: "私密查看宗門名冊" },
  {
    name: "member",
    description: "宗門成員管理（宗主）",
    options: [
      {
        name: "get",
        description: "查看正式成員詳細資料與燕雲綁定（宗主）",
        type: 1,
        options: [
          { name: "player", description: "從仙遊者 KV 名冊搜尋玩家", type: 3, required: true, autocomplete: true }
        ]
      },
      {
        name: "set-rank",
        description: "調整正式成員的身分（宗主）",
        type: 1,
        options: [
          { name: "player", description: "從仙遊者 KV 名冊搜尋玩家", type: 3, required: true, autocomplete: true },
          {
            name: "rank",
            description: "新的宗門身分",
            type: 3,
            required: true,
            choices: [
              { name: "弟子", value: "disciple" },
              { name: "長老", value: "elder" }
            ]
          },
          { name: "note", description: "調整原因或備註", type: 3, required: false, max_length: 300 }
        ]
      },
      {
        name: "remove",
        description: "將正式成員移出仙遊者名冊（宗主）",
        type: 1,
        options: [
          { name: "player", description: "從仙遊者 KV 名冊搜尋玩家", type: 3, required: true, autocomplete: true },
          {
            name: "confirm",
            description: "確認移除；燕雲 UID 綁定與歷史資料會保留",
            type: 3,
            required: true,
            choices: [
              { name: "確認移除", value: "REMOVE" }
            ]
          },
          { name: "note", description: "移除原因或備註", type: 3, required: false, max_length: 300 }
        ]
      }
    ]
  },
  { name: "sect", description: "私密查看宗門狀態" },
  {
    name: "profile",
    description: "私密查看或修改個人宗門資料",
    options: [
      {
        name: "view",
        description: "私密查看個人與宗門資料",
        type: 1
      },
      {
        name: "set-name",
        description: "修改自己在仙遊者名冊顯示的名稱",
        type: 1,
        options: [
          {
            name: "name",
            description: "新的仙遊者顯示名稱（1 至 32 個字）",
            type: 3,
            required: true,
            min_length: 1,
            max_length: 32
          }
        ]
      }
    ]
  },
  { name: "forget", description: "私密清除自己的 AI 記憶" },
  {
    name: "game",
    description: "燕雲十六聲角色綁定與管理",
    options: [
      {
        name: "bind",
        description: "申請綁定自己的燕雲 UID",
        type: 1,
        options: [
          { name: "uid", description: "遊戲 UID", type: 3, required: true },
          { name: "character_name", description: "目前角色名稱", type: 3, required: true, max_length: 50 }
        ]
      },
      { name: "status", description: "查看自己的燕雲角色綁定", type: 1 },
      { name: "pending", description: "查看待審 UID 綁定（宗主／長老）", type: 1 },
      {
        name: "approve",
        description: "核准 UID 綁定（宗主／長老）",
        type: 1,
        options: [
          { name: "applicant", description: "從 KV 待審綁定搜尋申請者", type: 3, required: true, autocomplete: true },
          { name: "note", description: "審核備註", type: 3, required: false, max_length: 300 }
        ]
      },
      {
        name: "reject",
        description: "拒絕 UID 綁定（宗主／長老）",
        type: 1,
        options: [
          { name: "applicant", description: "從 KV 待審綁定搜尋申請者", type: 3, required: true, autocomplete: true },
          { name: "note", description: "拒絕原因", type: 3, required: false, max_length: 300 }
        ]
      }
    ]
  },
  {
    name: "audit",
    description: "宗主私密查看仙遊者操作紀錄",
    options: [
      {
        name: "recent",
        description: "查看最近 10 筆操作紀錄",
        type: 1
      },
      {
        name: "view",
        description: "查看單筆操作紀錄詳情",
        type: 1,
        options: [
          {
            name: "record",
            description: "從最近的 Audit Log 搜尋紀錄",
            type: 3,
            required: true,
            autocomplete: true
          }
        ]
      }
    ]
  },
  { name: "help", description: "私密查看 Bot 使用說明" }
];

async function registerCommands() {
  if (!APPLICATION_ID || !BOT_TOKEN) {
    console.error("❌ 尚未設定本機 Discord 註冊資料。");
    console.error("請先執行：npm run setup:discord");
    console.error("完成後再執行：npm run register");
    process.exit(1);
  }

  const endpoint = GUILD_ID
    ? `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`
    : `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

  console.log(GUILD_ID
    ? `正在註冊伺服器指令（Guild ID: ${GUILD_ID}）...`
    : "正在註冊全域指令（可能需要一段時間才會顯示）...");

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
    console.error(`❌ Discord Commands 註冊失敗 HTTP ${response.status}`);
    console.error(text);
    process.exit(1);
  }

  console.log(
    "✅ Slash Commands 註冊完成：",
    COMMANDS.map(item => `/${item.name}`).join(" ")
  );
}

function loadLocalEnvironment() {
  for (const filename of [".dev.vars", ".env"]) {
    const path = resolve(filename);
    if (!existsSync(path)) continue;

    const content = readFileSync(path, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separator = line.indexOf("=");
      if (separator < 1) continue;

      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function clean(value) {
  return String(value || "").trim();
}

registerCommands().catch(error => {
  console.error("❌ 註冊指令時發生未預期錯誤：", error?.message || error);
  process.exit(1);
});
