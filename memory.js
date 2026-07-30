/**
 * ☯【仙遊者】☯ AI 管家 v3
 * Cloudflare KV 記憶系統
 *
 * 短期記憶：最近對話，30 天未使用自動過期
 * 長期記憶：稱呼、門派、職業、喜好，直到 /forget
 */

const MAX_TURNS = 8;
const MAX_HISTORY_CHARACTERS = 12000;
const CONVERSATION_TTL_SECONDS = 60 * 60 * 24 * 30;

function safeId(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function conversationKey(guildId, userId) {
  return [
    "conversation",
    safeId(guildId, "direct-message"),
    safeId(userId, "unknown")
  ].join(":");
}

function profileKey(guildId, userId) {
  return [
    "profile",
    safeId(guildId, "direct-message"),
    safeId(userId, "unknown")
  ].join(":");
}

function normalizeHistory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(item => {
    const role = item?.role;
    const text = item?.parts?.[0]?.text;

    return (
      (role === "user" || role === "model") &&
      typeof text === "string" &&
      text.trim() !== ""
    );
  });
}

/**
 * 同時限制輪數與總字元數，避免請求愈來愈大。
 */
function trimHistory(history) {
  const recent =
    normalizeHistory(history)
      .slice(-(MAX_TURNS * 2));

  const result = [];
  let totalCharacters = 0;

  for (
    let index = recent.length - 1;
    index >= 0;
    index--
  ) {
    const item = recent[index];
    const text = item.parts[0].text;
    const nextTotal =
      totalCharacters + text.length;

    if (
      result.length > 0 &&
      nextTotal > MAX_HISTORY_CHARACTERS
    ) {
      break;
    }

    result.unshift(item);
    totalCharacters = nextTotal;
  }

  /**
   * Gemini 多輪內容最好由 user 開始。
   */
  while (
    result.length > 0 &&
    result[0].role !== "user"
  ) {
    result.shift();
  }

  return result;
}

export async function loadMemory(
  env,
  guildId,
  userId
) {
  if (!env.BOT_MEMORY || !userId) {
    return [];
  }

  const data = await env.BOT_MEMORY.get(
    conversationKey(guildId, userId),
    { type: "json" }
  );

  return trimHistory(data);
}

export async function saveMemory(
  env,
  guildId,
  userId,
  question,
  answer
) {
  if (!env.BOT_MEMORY || !userId) {
    return;
  }

  const history =
    await loadMemory(env, guildId, userId);

  history.push(
    {
      role: "user",
      parts: [
        { text: String(question) }
      ]
    },
    {
      role: "model",
      parts: [
        { text: String(answer) }
      ]
    }
  );

  const limitedHistory =
    trimHistory(history);

  await env.BOT_MEMORY.put(
    conversationKey(guildId, userId),
    JSON.stringify(limitedHistory),
    {
      expirationTtl:
        CONVERSATION_TTL_SECONDS
    }
  );
}

export async function loadProfile(
  env,
  guildId,
  userId
) {
  if (!env.BOT_MEMORY || !userId) {
    return {};
  }

  const data = await env.BOT_MEMORY.get(
    profileKey(guildId, userId),
    { type: "json" }
  );

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return {};
  }

  return data;
}

export async function saveProfile(
  env,
  guildId,
  userId,
  profile
) {
  if (!env.BOT_MEMORY || !userId) {
    return;
  }

  await env.BOT_MEMORY.put(
    profileKey(guildId, userId),
    JSON.stringify({
      ...profile,
      updatedAt:
        new Date().toISOString()
    })
  );
}

/**
 * 從常見自然語句更新長期個人資料。
 */
export async function updateProfileFromMessage(
  env,
  guildId,
  userId,
  message
) {
  const text =
    String(message || "").trim();

  if (!text) {
    return {};
  }

  const profile =
    await loadProfile(env, guildId, userId);

  let changed = false;

  const rules = [
    {
      field: "nickname",
      patterns: [
        /(?:我叫|我的名字是|請叫我|稱呼我為)\s*([^，。！？\n]{1,30})/
      ]
    },
    {
      field: "sect",
      patterns: [
        /(?:我的門派是|我屬於|我的幫派是)\s*([^，。！？\n]{1,40})/
      ]
    },
    {
      field: "occupation",
      patterns: [
        /(?:我的職業是|我的身分是)\s*([^，。！？\n]{1,40})/
      ]
    },
    {
      field: "likes",
      patterns: [
        /(?:我喜歡|我的興趣是)\s*([^。！？\n]{1,100})/
      ]
    }
  ];

  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const match = text.match(pattern);

      if (match?.[1]) {
        profile[rule.field] =
          match[1].trim();

        changed = true;
        break;
      }
    }
  }

  if (changed) {
    await saveProfile(
      env,
      guildId,
      userId,
      profile
    );
  }

  return profile;
}

export async function clearAllMemory(
  env,
  guildId,
  userId
) {
  if (!env.BOT_MEMORY || !userId) {
    return;
  }

  await Promise.all([
    env.BOT_MEMORY.delete(
      conversationKey(guildId, userId)
    ),
    env.BOT_MEMORY.delete(
      profileKey(guildId, userId)
    )
  ]);
}

export function formatProfile(profile) {
  const rows = [];

  if (profile.nickname) {
    rows.push(`• 稱呼：${profile.nickname}`);
  }

  if (profile.sect) {
    rows.push(`• 門派／幫派：${profile.sect}`);
  }

  if (profile.occupation) {
    rows.push(
      `• 身分／職業：${profile.occupation}`
    );
  }

  if (profile.likes) {
    rows.push(`• 興趣喜好：${profile.likes}`);
  }

  if (rows.length === 0) {
    return [
      "目前還沒有記住你的個人資料。",
      "",
      "你可以對老祖說：",
      "• 我叫凜冬皓月",
      "• 我的門派是青溪",
      "• 我喜歡宋朝建築"
    ].join("\n");
  }

  return [
    "☯ 我目前記得你的資料：",
    "",
    ...rows
  ].join("\n");
}
