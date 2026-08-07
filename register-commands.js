import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

loadLocalEnvironment();

const APPLICATION_ID = clean(process.env.DISCORD_APPLICATION_ID);
const BOT_TOKEN = clean(process.env.DISCORD_BOT_TOKEN);
const GUILD_ID = clean(process.env.DISCORD_GUILD_ID);

export const ENGLISH_COMMANDS = [
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
    name: "review",
    description: "私密審核入宗申請（宗主／長老）",
    options: [
      {
        name: "applicant",
        description: "從待審入宗申請搜尋玩家",
        type: 3,
        required: true,
        autocomplete: true
      },
      {
        name: "decision",
        description: "選擇核准或拒絕",
        type: 3,
        required: true,
        choices: [
          { name: "核准", value: "approve" },
          { name: "拒絕", value: "reject" }
        ]
      },
      {
        name: "note",
        description: "審核原因或備註",
        type: 3,
        required: false,
        max_length: 500
      }
    ]
  },
  {
    name: "panel",
    description: "在目前頻道建立老祖互動面板（宗主／長老）",
    options: [
      {
        name: "type",
        description: "指定要建立的面板；未指定時沿用目前頻道的既有判斷",
        type: 3,
        required: false,
        choices: [
          { name: "每日請安", value: "greeting" },
          { name: "宗主管理", value: "admin" }
        ]
      }
    ]
  },
  {
    name: "members",
    description: "私密分頁查看宗門名冊",
    options: [
      {
        name: "page",
        description: "要查看的頁碼（預設第 1 頁）",
        type: 4,
        required: false,
        min_value: 1
      }
    ]
  },
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
              { name: "領民", value: "resident" },
              { name: "門徒", value: "disciple" },
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
        name: "review",
        description: "審核 UID 綁定（宗主／長老）",
        type: 1,
        options: [
          { name: "applicant", description: "從 KV 待審綁定搜尋申請者", type: 3, required: true, autocomplete: true },
          {
            name: "decision",
            description: "選擇核准或拒絕",
            type: 3,
            required: true,
            choices: [
              { name: "核准", value: "approve" },
              { name: "拒絕", value: "reject" }
            ]
          },
          { name: "note", description: "審核原因或備註", type: 3, required: false, max_length: 300 }
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
  {
    name: "laozu",
    description: "老祖互動、成員媒合與宗門處置",
    options: [
      {
        name: "memory",
        description: "私密查閱、共享或刪除自己的老祖事件記憶",
        type: 1
      },
      {
        name: "offer",
        description: "自願公開可協助的專長，供老祖媒合",
        type: 1,
        options: [
          { name: "skills", description: "可協助的專長；以頓號分隔", type: 3, required: true, min_length: 2, max_length: 300 },
          { name: "availability", description: "方便聯絡或協助的時間", type: 3, required: true, min_length: 2, max_length: 120 },
          {
            name: "consent",
            description: "確認同意向仙遊者成員公開以上媒合資料",
            type: 3,
            required: true,
            choices: [{ name: "同意公開媒合", value: "AGREE" }]
          },
          { name: "note", description: "其他媒合備註（請勿填寫敏感資料）", type: 3, required: false, max_length: 300 }
        ]
      },
      {
        name: "match",
        description: "從已同意公開的成員資料尋找協助",
        type: 1,
        options: [
          { name: "need", description: "需要哪方面的協助", type: 3, required: true, min_length: 2, max_length: 300 }
        ]
      },
      {
        name: "withdraw",
        description: "撤回自己的公開媒合資料",
        type: 1
      },
      {
        name: "invite",
        description: "向已公開專長的成員提出私人媒合邀請",
        type: 1,
        options: [
          { name: "player", description: "受邀的仙遊者成員", type: 6, required: true },
          { name: "need", description: "希望對方協助的事項", type: 3, required: true, min_length: 2, max_length: 300 }
        ]
      },
      {
        name: "respond",
        description: "由受邀者接受或婉拒私人媒合邀請",
        type: 1,
        options: [
          { name: "invitation_id", description: "媒合邀請編號", type: 3, required: true },
          { name: "decision", description: "接受或婉拒", type: 3, required: true, choices: [
            { name: "接受", value: "accept" },
            { name: "婉拒", value: "decline" }
          ] }
        ]
      },
      {
        name: "invitation",
        description: "僅限邀請雙方查看私人媒合邀請狀態",
        type: 1,
        options: [
          { name: "invitation_id", description: "媒合邀請編號", type: 3, required: true }
        ]
      },
      {
        name: "reprimand",
        description: "公開訓誡一名正式成員並降低好感（宗主）",
        type: 1,
        options: [
          {
            name: "player",
            description: "要由老祖訓誡的 Discord 玩家",
            type: 6,
            required: true
          },
          {
            name: "affection",
            description: "扣除好感度（1 至 5）",
            type: 4,
            required: true,
            min_value: 1,
            max_value: 5
          },
          {
            name: "reason",
            description: "訓誡原因",
            type: 3,
            required: true,
            min_length: 2,
            max_length: 300
          }
        ]
      }
    ]
  },
  {
    name: "system",
    description: "宗主私密檢查與修復系統資料索引",
    options: [
      {
        name: "check",
        description: "只讀檢查 KV 資料與索引一致性",
        type: 1
      },
      {
        name: "repair",
        description: "安全重建 KV 索引，不刪除實體資料",
        type: 1,
        options: [
          {
            name: "confirm",
            description: "確認執行索引修復",
            type: 3,
            required: true,
            choices: [{ name: "確認修復索引", value: "REPAIR" }]
          }
        ]
      }
    ]
  },
  { name: "help", description: "使用按鈕私密查看可用指令" }
];

// Custom sect roles cannot be represented by Discord permission bits. Keep every
// command available at Discord's registration layer and authorize ranks in the Worker.
export const COMMANDS = ENGLISH_COMMANDS.map(command => ({
  ...command,
  default_member_permissions: null,
  dm_permission: false
}));

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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  registerCommands().catch(error => {
    console.error("❌ 註冊指令時發生未預期錯誤：", error?.message || error);
    process.exit(1);
  });
}
