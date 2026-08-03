import assert from "node:assert/strict";
import test from "node:test";

import {
  askGemini,
  resolveGeminiSettings
} from "../gemini.js";

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

async function capturePrompt(member) {
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
      member
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  return requestBody.systemInstruction.parts[0].text;
}

for (const [rank, expectedLabel] of [
  ["master", "宗主"],
  ["elder", "長老"],
  ["disciple", "正式弟子"]
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
