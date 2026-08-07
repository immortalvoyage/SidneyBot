import assert from "node:assert/strict";
import test from "node:test";

import {
  askGemini,
  resolveGeminiSettings
} from "../gemini.js";
import { buildLaozuSystemPrompt } from "../src/prompts/prompt-builder.js";

function okResponse(answer = "測試回答") {
  return {
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: answer }]
            }
          }
        ]
      });
    }
  };
}

async function capturePrompt(member, playerState = null, options = {}) {
  const originalFetch = globalThis.fetch;
  let requestBody = null;

  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return okResponse();
  };

  try {
    await askGemini(
      "測試身分",
      {
        GEMINI_API_KEY: "test-key",
        GEMINI_MODEL: "test-primary",
        GEMINI_FALLBACK_MODELS: ""
      },
      [],
      {},
      member,
      playerState,
      options
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  return requestBody.systemInstruction.parts[0].text;
}

test("萬象錄關係與請安摘要會傳入老祖 Prompt", async () => {
  const prompt = await capturePrompt(
    {
      userId: "123",
      displayName: "測試成員",
      rank: "resident",
      active: true
    },
    {
      userId: "123",
      relationship: {
        favor: 81,
        trust: 67,
        grudge: 3
      },
      greeting: {
        currentStreak: 7,
        longestStreak: 9,
        totalDays: 20,
        lastDate: "2026-08-04"
      }
    }
  );

  assert.match(prompt, /宗門身份：領民/);
  assert.match(prompt, /好感：81/);
  assert.match(prompt, /信任：67/);
  assert.match(prompt, /目前連續請安：7 天/);
  assert.match(prompt, /不得自行更改分數/);
});

test("名冊上下文禁止依 mention 猜測或編故事圓場", async () => {
  const prompt = await capturePrompt(
    { userId: "111", displayName: "凜冬皓月", rank: "master", active: true },
    null,
    { sectContext: "正式名冊共 2 人：\n- Discord ID 111｜名稱 凜冬皓月｜身分 宗主\n- Discord ID 222｜名稱 沈慕白｜身分 門徒" }
  );
  assert.match(prompt, /Discord mention/);
  assert.match(prompt, /數字 ID 與名冊逐字比對/);
  assert.match(prompt, /不得編造對方離宗、遊歷、閉關、乾脆、改名或被遺忘/);
  assert.match(prompt, /Discord 一般聊天優先控制在 3 個短段落內/);
  assert.match(prompt, /不輸出 Discord 數字 ID/);
  assert.match(prompt, /動作或神態描寫最多一句/);
});

test("目前說話者身分優先於遭污染的歷史稱呼", async () => {
  const prompt = buildLaozuSystemPrompt({
    member: {
      userId: "123456789012345678",
      displayName: "小手冰涼正常",
      nickname: "小手冰涼正常",
      rank: "disciple",
      active: true
    },
    historySummary: "老祖先前錯把這名玩家叫成小月。"
  });

  assert.match(prompt, /Discord 使用者 ID：123456789012345678/);
  assert.match(prompt, /老祖稱呼：小手冰涼正常/);
  assert.match(prompt, /只能使用「老祖稱呼」/);
  assert.match(prompt, /視為先前辨識錯誤，不得沿用/);
  assert.match(prompt, /摘要中的人名不得覆蓋/);
});

test("沒有萬象錄資料時禁止老祖猜測關係狀態", async () => {
  const prompt = await capturePrompt({
    userId: "123",
    displayName: "測試成員",
    rank: "resident",
    active: true
  });

  assert.match(prompt, /目前沒有可用的萬象錄資料/);
  assert.match(prompt, /不得自行猜測好感、信任、請安紀錄/);
});

test("老祖 Prompt 明確限制未知系統狀態且維持角色口吻", async () => {
  const prompt = await capturePrompt({
    userId: "123",
    displayName: "測試成員",
    rank: "resident",
    active: true
  });

  assert.match(prompt, /【系統狀態與事實邊界】/);
  assert.match(prompt, /未提供的連線、部署、排程、權限、資料庫、訊息收發或操作結果/);
  assert.match(prompt, /不得臨時編造故事圓場/);
  assert.match(prompt, /仍須保持老祖的人格、情緒、幽默與世界觀/);
  assert.match(prompt, /不得退回人工智慧、客服或生硬技術口吻/);
  assert.match(prompt, /不得使用「身為 AI」「我無法存取系統」/);
  assert.match(prompt, /不得說「稍後再問」「等一下再喚本座」/);
  assert.match(prompt, /不得猜測 CPU 使用率/);
  assert.match(prompt, /只有目前訊息或程式明確提供可用的查詢工具、監測來源或待執行動作時/);
  assert.match(prompt, /不得以虛假的未來承諾掩飾能力邊界/);
});

for (const [rank, expectedLabel] of [
  ["master", "宗主"],
  ["elder", "長老"],
  ["disciple", "門徒"]
]) {
  test(`真實 ${expectedLabel} 身分會傳入老祖 Prompt`, async () => {
    const prompt = await capturePrompt({
      userId: "123",
      displayName: "測試成員",
      rank,
      active: true
    });

    assert.match(prompt, new RegExp(`宗門身份：${expectedLabel}`));
  });
}

test("Cloudflare env 會覆蓋 config.js 的 Gemini 設定", () => {
  const settings = resolveGeminiSettings({
    GEMINI_MODEL: "env-primary",
    GEMINI_FALLBACK_MODELS: "env-fallback-1, env-fallback-2",
    GEMINI_MAX_OUTPUT_TOKENS: "2048",
    GEMINI_TIMEOUT_MS: "12345",
    GEMINI_MAX_RETRIES: "4"
  });

  assert.deepEqual(settings, {
    models: ["env-primary", "env-fallback-1", "env-fallback-2"],
    maxRetries: 4,
    timeoutMs: 12345,
    maxOutputTokens: 2048
  });
});

test("內建模型設定不包含 gemini-2.5", () => {
  const settings = resolveGeminiSettings({});
  assert.deepEqual(settings.models, [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash"
  ]);
  assert.equal(settings.models.some(model => model.includes("gemini-2.5")), false);
});

test("主模型失敗後會依序使用備援模型", async () => {
  const originalFetch = globalThis.fetch;
  const calledModels = [];

  globalThis.fetch = async (url) => {
    const model = decodeURIComponent(
      url.match(/\/models\/(.+):generateContent$/)[1]
    );
    calledModels.push(model);

    if (model !== "fallback-2") {
      return {
        ok: false,
        status: 404,
        async text() {
          return JSON.stringify({
            error: {
              status: "NOT_FOUND",
              message: "model not found"
            }
          });
        }
      };
    }

    return okResponse("備援成功");
  };

  try {
    const answer = await askGemini(
      "測試備援",
      {
        GEMINI_API_KEY: "test-key",
        GEMINI_MODEL: "primary",
        GEMINI_FALLBACK_MODELS: "fallback-1,fallback-2",
        GEMINI_MAX_RETRIES: "1"
      },
      [],
      {},
      {
        displayName: "測試弟子",
        rank: "disciple",
        active: true
      }
    );

    assert.equal(answer, "備援成功");
    assert.deepEqual(calledModels, ["primary", "fallback-1", "fallback-2"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
