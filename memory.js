import CONFIG from "./config.js";

function safe(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function historyKey(guildId, userId) {
  return `history:${safe(guildId, "dm")}:${safe(userId, "unknown")}`;
}

function profileKey(guildId, userId) {
  return `profile:${safe(guildId, "dm")}:${safe(userId, "unknown")}`;
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) return [];

  return value.filter(item => {
    const role = item?.role;
    const text = item?.parts?.[0]?.text;
    return (
      ["user", "model"].includes(role) &&
      typeof text === "string" &&
      text.trim()
    );
  });
}

function trimHistory(history) {
  const maxItems = CONFIG.MEMORY.MAX_TURNS * 2;
  const recent = normalizeHistory(history).slice(-maxItems);
  const output = [];
  let total = 0;

  for (let index = recent.length - 1; index >= 0; index--) {
    const item = recent[index];
    const length = item.parts[0].text.length;

    if (
      output.length > 0 &&
      total + length > CONFIG.MEMORY.MAX_CHARACTERS
    ) {
      break;
    }

    output.unshift(item);
    total += length;
  }

  while (output.length && output[0].role !== "user") {
    output.shift();
  }

  return output;
}

export async function loadMemory(env, guildId, userId) {
  if (!env.BOT_MEMORY || !userId) return [];

  const value = await env.BOT_MEMORY.get(
    historyKey(guildId, userId),
    { type: "json" }
  );

  return trimHistory(value);
}

export async function saveMemory(
  env,
  guildId,
  userId,
  question,
  answer
) {
  if (!env.BOT_MEMORY || !userId) return;

  const history = await loadMemory(env, guildId, userId);

  history.push(
    {
      role: "user",
      parts: [{ text: String(question) }]
    },
    {
      role: "model",
      parts: [{ text: String(answer) }]
    }
  );

  await env.BOT_MEMORY.put(
    historyKey(guildId, userId),
    JSON.stringify(trimHistory(history)),
    {
      expirationTtl: CONFIG.MEMORY.TTL_SECONDS
    }
  );
}

export async function loadProfile(env, guildId, userId) {
  if (!env.BOT_MEMORY || !userId) return {};

  return (
    await env.BOT_MEMORY.get(
      profileKey(guildId, userId),
      { type: "json" }
    )
  ) || {};
}

export async function saveProfile(
  env,
  guildId,
  userId,
  profile
) {
  if (!env.BOT_MEMORY || !userId) return;

  await env.BOT_MEMORY.put(
    profileKey(guildId, userId),
    JSON.stringify(profile || {})
  );
}

export async function clearUserMemory(
  env,
  guildId,
  userId
) {
  if (!env.BOT_MEMORY || !userId) return;

  await Promise.all([
    env.BOT_MEMORY.delete(historyKey(guildId, userId)),
    env.BOT_MEMORY.delete(profileKey(guildId, userId))
  ]);
}

export function formatProfile(profile) {
  const rows = [];
  if (profile?.nickname) rows.push(`稱呼：${profile.nickname}`);
  if (profile?.occupation) rows.push(`身分／職業：${profile.occupation}`);
  if (profile?.likes) rows.push(`興趣喜好：${profile.likes}`);
  if (profile?.notes) rows.push(`備註：${profile.notes}`);

  return rows.length
    ? rows.join("\n")
    : "尚無已儲存的個人資料。";
}
