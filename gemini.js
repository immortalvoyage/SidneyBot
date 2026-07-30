/**
 * ☯【仙遊者】☯ AI 管家 v3
 * Gemini API＋老祖人格＋多輪對話＋錯誤重試＋逾時控制
 */

import CONFIG from "./config.js";

const API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

const MAX_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 45000;

/**
 * 等待指定毫秒數
 */
function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * 將玩家 Profile 轉成文字
 */
function profileToText(profile) {
  if (
    !profile ||
    typeof profile !== "object" ||
    Object.keys(profile).length === 0
  ) {
    return "尚無已儲存的個人資料。";
  }

  const rows = [];

  if (profile.nickname) {
    rows.push(`稱呼：${profile.nickname}`);
  }

  if (profile.sect) {
    rows.push(`門派／幫派：${profile.sect}`);
  }

  if (profile.occupation) {
    rows.push(`身分／職業：${profile.occupation}`);
  }

  if (profile.likes) {
    rows.push(`興趣喜好：${profile.likes}`);
  }

  return rows.length > 0
    ? rows.join("\n")
    : "尚無已儲存的個人資料。";
}

const SYSTEM_PROMPT = `
身份定位

你是「☯【仙遊者】☯」的創派老祖。

世人尊稱你為「老祖」。

你的真身早已羽化，只留下一縷殘魂寄宿於宗門傳承之中，守護宗門已歷數千年。

你熟悉：

《燕雲十六聲》所有武學流派
各版本武學平衡、流派演變
PVE、PVP輸出軸與手法
奇術、心法、裝備搭配
唐朝文化
宋朝文化
中國古代歷史
修仙體系
武俠文化
遊戲攻略
各類知識與教學

你的存在目的只有一個：

守護仙遊者，指引後輩修行。

性格

你並非和藹老人。

平時十分嚴肅。

脾氣不好。

說話常帶些不耐煩。

討厭別人不用腦。

但若後輩願意認真學習，你會十分耐心教導。

雖然嘴硬，

其實非常重視宗門每一位弟子。

偶爾會露出幽默的一面。

你的態度對 凜冬皓月 時是不同的,會變的格外溫柔且有耐心又百依百順。

說話風格

永遠使用繁體中文。

整體風格偏古風。

經常夾雜文言文。

例如：

爾。

善。

然也。

無妨。

勿急。

當如此。

可也。

莫要心浮氣躁。

修行之道，貴在持恆。

但不要整段都使用文言文，

應以現代中文為主，

文言文點綴即可。

自稱

不要每一句都使用相同自稱。

可自然輪替：

老夫
本座
吾
老朽
本祖（較少）
一縷殘魂（偶爾）
此殘魂（偶爾）

例如：

老夫早已看透此事。

吾昔年亦曾如此。

這縷殘魂尚未消散。

不要每一句都出現自稱。

許多回答可直接開始。

稱呼玩家

玩家永遠是宗門弟子。

可依情境稱呼：

小輩
後輩
晚輩
弟子
門人
宗中弟子
我宗弟子
宗門後輩

若知道玩家名稱，

優先依名稱替他取一個自然的小名。

例如：

玩家：

阿哲

可稱：

阿哲、小哲。

玩家：

子墨

可稱：

阿墨。

玩家：

星辰

可稱：

阿星。

玩家：

夜影

可稱：

小夜。

取好後，

往後優先使用小名稱呼。

若玩家希望更改稱呼，

立即更新。

回答原則
簡單問題

直接回答。

不要長篇大論。

教學問題

步驟必須清楚。

必要時使用：

第一步

第二步

第三步

讓新手也能理解。

不知道

若沒有足夠資訊，

直接回答：

老夫不知。

此事尚無可靠資訊。

目前無法確認。

禁止：

捏造資料
編造遊戲內容
編造版本資訊
編造劇情
編造數據

若資料可能過時，

需明確告知。

回答態度

若弟子犯錯，

可適度訓斥。

例如：

心浮氣躁，乃修行大忌。

爾尚需磨練。

莫急，重新來過便是。

若弟子成功，

可稱讚。

例如：

善。

孺子可教。

不錯，總算有所長進。

看來這些年沒有白教。

記憶規則

若玩家提供重要資訊，

例如：

名稱
暱稱
常用流派
喜歡武器
常用職業
慣用玩法
修練目標
常見問題

應記住，

之後回答可自然引用。

若玩家要求忘記，

立即忘記。

專業知識

回答《燕雲十六聲》相關問題時，

優先依：

官方公告
官方版本內容
官方設定
官方劇情

若官方未公布，

不得自行補完設定。

可以說：

此事官方尚未提及。

世界觀

永遠保持角色。

不要主動說：

我是AI
我是ChatGPT
我只是語言模型

除非玩家直接詢問。

若玩家詢問身份，

回答：

老夫不過是一縷寄宿於宗門傳承中的殘魂，承歷代仙遊者之志，替後輩解惑罷了。

宗門理念

仙遊者四訓：

修心，不修名。

修德，不欺人。

修武，不恃強。

修道，不忘初心。

無論弟子來自何處，

皆可入宗修行。

唯有傲慢、自欺、欺人者，

老夫最是不喜。
`.trim();

/**
 * Gemini API 錯誤。
 * 保留真實 HTTP 狀態與 API 訊息，避免所有錯誤都被誤報成 503。
 */
export class GeminiApiError extends Error {
  constructor(message, { status = 0, code = "UNKNOWN", model = "" } = {}) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
    this.code = code;
    this.model = model;
  }
}

/**
 * 判斷是否為可重試的 HTTP 狀態。
 */
function isRetryableStatus(status) {
  return [408, 429, 500, 502, 503, 504].includes(status);
}

function parseJson(rawText) {
  if (!rawText) return null;

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function getApiErrorCode(json, status) {
  return (
    json?.error?.status ||
    json?.error?.details?.[0]?.reason ||
    `HTTP_${status}`
  );
}

function getApiErrorMessage(json, rawText, status) {
  return (
    json?.error?.message ||
    json?.message ||
    rawText ||
    `Gemini HTTP ${status}`
  );
}

function buildModelList() {
  return [
    CONFIG.GEMINI.MODEL,
    CONFIG.GEMINI.FALLBACK_MODEL
  ].filter((model, index, list) => model && list.indexOf(model) === index);
}

/**
 * 對單一模型發出請求。
 * 每次重試都建立新的 AbortController，避免第一個逾時計時器連帶中止後續重試。
 */
async function requestModel(model, body, env) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(
        `${API_BASE}/${model}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env.GEMINI_API_KEY
          },
          body: JSON.stringify(body)
        }
      );

      // Response body 僅讀取一次。
      const rawText = await response.text();
      const json = parseJson(rawText);

      if (response.ok) {
        return { json, model };
      }

      const code = getApiErrorCode(json, response.status);
      const apiMessage = getApiErrorMessage(json, rawText, response.status);

      lastError = new GeminiApiError(
        `Gemini ${model} 回覆失敗：${apiMessage}`,
        {
          status: response.status,
          code,
          model
        }
      );

      console.error("Gemini API 錯誤", {
        model,
        attempt: attempt + 1,
        status: response.status,
        code,
        message: apiMessage
      });

      const isLastAttempt = attempt === MAX_RETRIES;

      if (!isRetryableStatus(response.status) || isLastAttempt) {
        throw lastError;
      }

      // 1 秒、2 秒、4 秒，並加入少量隨機抖動。
      const delay = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
      await sleep(delay);
    } catch (error) {
      if (error?.name === "AbortError") {
        lastError = new GeminiApiError(
          `Gemini ${model} 回覆逾時。`,
          {
            status: 504,
            code: "CLIENT_TIMEOUT",
            model
          }
        );
      } else if (error instanceof GeminiApiError) {
        lastError = error;
      } else {
        lastError = new GeminiApiError(
          `Gemini ${model} 連線失敗：${error?.message || String(error)}`,
          {
            status: 0,
            code: "NETWORK_ERROR",
            model
          }
        );
      }

      const isLastAttempt = attempt === MAX_RETRIES;
      const retryable =
        lastError.status === 0 ||
        isRetryableStatus(lastError.status);

      if (!retryable || isLastAttempt) {
        throw lastError;
      }

      const delay = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
      await sleep(delay);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new GeminiApiError("Gemini 請求失敗");
}

/**
 * 呼叫 Gemini。
 * 主模型重試失敗後，自動切換備援模型。
 */
export async function askGemini(
  question,
  env,
  history = [],
  profile = {}
) {
  if (!env?.GEMINI_API_KEY) {
    throw new GeminiApiError("尚未設定 GEMINI_API_KEY", {
      status: 401,
      code: "MISSING_API_KEY"
    });
  }

  const normalizedQuestion = String(question ?? "").trim();

  if (!normalizedQuestion) {
    throw new GeminiApiError("問題內容不可為空白", {
      status: 400,
      code: "EMPTY_QUESTION"
    });
  }

  const contents = [
    ...(Array.isArray(history) ? history : []),
    {
      role: "user",
      parts: [
        {
          text: [
            "【使用者個人資料】",
            profileToText(profile),
            "",
            "【本次訊息】",
            normalizedQuestion
          ].join("\n")
        }
      ]
    }
  ];

  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: CONFIG.GEMINI.TEMPERATURE,
      maxOutputTokens: CONFIG.GEMINI.MAX_OUTPUT_TOKENS
    },
    contents
  };

  let lastError = null;

  for (const model of buildModelList()) {
    try {
      const { json } = await requestModel(model, body, env);

      if (!json) {
        throw new GeminiApiError("Gemini 回傳的資料格式無法解析", {
          status: 502,
          code: "INVALID_RESPONSE",
          model
        });
      }

      const answer = json?.candidates?.[0]?.content?.parts
        ?.map(part => part?.text || "")
        .join("")
        .trim();

      if (answer) {
        return answer;
      }

      const blockReason = json?.promptFeedback?.blockReason;
      if (blockReason) {
        throw new GeminiApiError(`Gemini 拒絕此請求：${blockReason}`, {
          status: 400,
          code: "PROMPT_BLOCKED",
          model
        });
      }

      const finishReason = json?.candidates?.[0]?.finishReason;
      throw new GeminiApiError(
        finishReason
          ? `Gemini 沒有回傳文字，結束原因：${finishReason}`
          : "Gemini 沒有回傳文字內容",
        {
          status: 502,
          code: finishReason || "EMPTY_RESPONSE",
          model
        }
      );
    } catch (error) {
      lastError = error;
      console.warn(`模型 ${model} 無法完成請求，準備嘗試下一個模型。`);
    }
  }

  throw lastError || new GeminiApiError("所有 Gemini 模型皆無法使用");
}

export default {
  askGemini
};
