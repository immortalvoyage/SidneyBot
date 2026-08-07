const SUGGESTION_PREFIX = "laozu:capability:v1:suggestion:";
const BLACKLIST_PREFIX = "laozu:capability:v1:blacklist:";

function clean(value, maxLength = 500) {
  return String(value || "").normalize("NFC").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function fingerprint(value) {
  const text = clean(value, 300)
    .toLocaleLowerCase("zh-Hant")
    .replace(/[\s，。！？、；：,.!?;:'"「」『』（）()\[\]{}]/gu, "")
    .slice(0, 180);
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function detectLaozuConversationIntent(input) {
  const text = clean(input, 1800);
  const career = /(換(個)?工作|找工作|轉職|兼職|副業|接案|打工|開小差|想賺點外快|有沒有工作機會|求職)/u.test(text);
  const asksForPeople = /(找|需要|徵|缺).{0,12}(人|人才|幫手|工程師|設計師|程式設計師|美術|剪輯|翻譯|會計|顧問|開發者)/u.test(text)
    || /(有沒有|誰會|誰可以|誰能).{0,16}(幫忙|協助|做|處理|設計|開發|寫程式|剪輯|翻譯)/u.test(text);
  const capabilityRequest = /(老祖|妳|你).{0,10}(能不能|可不可以|可以幫|希望|應該要|最好能|怎麼不能|為什麼不能|如果能).{1,120}/u.test(text)
    || /(希望|建議).{0,16}(老祖|系統|平台).{0,80}(可以|能|支援|新增)/u.test(text);
  return { career, asksForPeople, capabilityRequest };
}

export async function recordCapabilitySuggestion(env, { text, userId = "", guildId = "" }) {
  if (!env?.BOT_MEMORY) return null;
  const normalized = clean(text, 300);
  if (normalized.length < 4) return null;
  const id = fingerprint(normalized);
  if (await env.BOT_MEMORY.get(`${BLACKLIST_PREFIX}${id}`)) return null;

  const key = `${SUGGESTION_PREFIX}${id}`;
  const existing = await env.BOT_MEMORY.get(key, { type: "json" });
  const now = new Date().toISOString();
  const item = existing || {
    id,
    text: normalized,
    status: "pending",
    firstSeenAt: now,
    count: 0,
    examples: []
  };
  item.count = Number(item.count || 0) + 1;
  item.lastSeenAt = now;
  item.lastUserId = clean(userId, 30);
  item.lastGuildId = clean(guildId, 30);
  if (!item.examples.includes(normalized)) item.examples = [...item.examples, normalized].slice(-3);
  await env.BOT_MEMORY.put(key, JSON.stringify(item));
  return item;
}

export async function listCapabilitySuggestions(env, limit = 5) {
  if (!env?.BOT_MEMORY?.list) return [];
  const listed = await env.BOT_MEMORY.list({ prefix: SUGGESTION_PREFIX, limit: 100 });
  const rows = await Promise.all((listed.keys || []).map(key => env.BOT_MEMORY.get(key.name, { type: "json" })));
  return rows
    .filter(item => item?.status === "pending")
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0) || String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")))
    .slice(0, Math.max(1, Math.min(Number(limit) || 5, 5)));
}

export async function resolveCapabilitySuggestion(env, id, decision) {
  if (!env?.BOT_MEMORY) throw new Error("老祖能力建議資料庫尚未設定");
  const normalizedId = clean(id, 32);
  if (!/^[a-z0-9]+$/u.test(normalizedId)) throw new Error("能力建議識別碼無效");
  if (!["developed", "rejected"].includes(decision)) throw new Error("能力建議處理狀態無效");
  const key = `${SUGGESTION_PREFIX}${normalizedId}`;
  const item = await env.BOT_MEMORY.get(key, { type: "json" });
  if (!item) throw new Error("找不到這筆能力建議，可能已被處理");
  item.status = decision;
  item.resolvedAt = new Date().toISOString();
  await env.BOT_MEMORY.put(key, JSON.stringify(item));
  if (decision === "rejected") {
    await env.BOT_MEMORY.put(`${BLACKLIST_PREFIX}${normalizedId}`, JSON.stringify({
      id: normalizedId,
      text: item.text,
      rejectedAt: item.resolvedAt
    }));
  }
  return item;
}
