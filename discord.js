const DISCORD_API = "https://discord.com/api/v10";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}

export function immediateResponse(content, ephemeral = false, components = []) {
  return json({
    type: 4,
    data: {
      content: String(content || ""),
      flags: ephemeral ? 64 : 0,
      allowed_mentions: { parse: [] },
      components: Array.isArray(components) ? components : []
    }
  });
}

export function componentResponse(content, components = [], ephemeral = true) {
  return json({ type: 4, data: { content: String(content || ""), components, flags: ephemeral ? 64 : 0, allowed_mentions: { parse: [] } } });
}

export function modalResponse(customId, title, components = []) {
  return json({ type: 9, data: { custom_id: String(customId || ""), title: String(title || "").slice(0, 45), components } });
}

export function deferredResponse(ephemeral = false) {
  return json({
    type: 5,
    data: {
      flags: ephemeral ? 64 : 0
    }
  });
}

export async function deleteOriginalResponse(applicationId, token) {
  const normalizedApplicationId = String(applicationId || "").trim();
  const normalizedToken = String(token || "").trim();
  if (!normalizedApplicationId || !normalizedToken) {
    throw new Error("缺少 Discord Application ID 或互動 Token");
  }

  await discordFetch(
    `${DISCORD_API}/webhooks/${normalizedApplicationId}/${normalizedToken}/messages/@original`,
    { method: "DELETE" }
  );
}

export function autocompleteResponse(choices = []) {
  return json({
    type: 8,
    data: {
      choices: Array.isArray(choices) ? choices.slice(0, 25) : []
    }
  });
}

export function updateMessageResponse(data = {}) {
  return json({
    type: 7,
    data: {
      ...data,
      allowed_mentions: { parse: [] }
    }
  });
}

export async function sendChannelMessage(
  channelId,
  botToken,
  content,
  options = {}
) {
  const normalizedChannelId = String(channelId || "").trim();
  const normalizedToken = String(botToken || "").trim();

  if (!normalizedChannelId || !normalizedToken) {
    throw new Error("尚未設定入宗審核頻道或 Discord Bot Token");
  }

  const response = await discordFetch(
    `${DISCORD_API}/channels/${normalizedChannelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${normalizedToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: String(content || ""),
        components: Array.isArray(options.components) ? options.components : [],
        allowed_mentions: { parse: [] }
      })
    }
  );

  return response.json();
}

export async function sendUserDirectMessage(userId, botToken, content) {
  const normalizedUserId = String(userId || "").trim();
  const normalizedToken = String(botToken || "").trim();
  if (!normalizedUserId || !normalizedToken) {
    throw new Error("缺少 Discord 玩家 ID 或 Bot Token");
  }

  const channelResponse = await discordFetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${normalizedToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ recipient_id: normalizedUserId })
  });
  const channel = await channelResponse.json();
  if (!channel?.id) throw new Error("Discord 未回傳私人訊息頻道");

  const messageResponse = await discordFetch(
    `${DISCORD_API}/channels/${channel.id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${normalizedToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: String(content || ""),
        allowed_mentions: { parse: [] }
      })
    }
  );
  return messageResponse.json();
}

export async function replaceGuildMemberRoles(
  guildId,
  userId,
  botToken,
  managedRoleIds,
  desiredRoleIds
) {
  const normalizedGuildId = String(guildId || "").trim();
  const normalizedUserId = String(userId || "").trim();
  const normalizedToken = String(botToken || "").trim();
  const managed = new Set((managedRoleIds || []).map(String).filter(Boolean));
  const desired = (desiredRoleIds || []).map(String).filter(Boolean);

  if (!normalizedGuildId || !normalizedUserId || !normalizedToken) {
    throw new Error("缺少 Discord 伺服器、成員或 Bot Token 設定");
  }
  if (!managed.size) {
    throw new Error("尚未設定仙遊者 Discord 身分組 ID");
  }

  const url = `${DISCORD_API}/guilds/${normalizedGuildId}/members/${normalizedUserId}`;
  const memberResponse = await discordFetch(url, {
    headers: { Authorization: `Bot ${normalizedToken}` }
  });
  const member = await memberResponse.json();
  const existing = Array.isArray(member.roles) ? member.roles.map(String) : [];
  const roles = [...new Set([
    ...existing.filter(roleId => !managed.has(roleId)),
    ...desired
  ])];

  await discordFetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${normalizedToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ roles })
  });

  return { previousRoles: existing, roles };
}

export async function getGuildMember(guildId, userId, botToken) {
  const normalizedGuildId = String(guildId || "").trim();
  const normalizedUserId = String(userId || "").trim();
  const normalizedToken = String(botToken || "").trim();

  if (!normalizedGuildId || !normalizedUserId || !normalizedToken) {
    throw new Error("缺少 Discord 伺服器、玩家或 Bot Token 設定");
  }

  const response = await discordFetch(
    `${DISCORD_API}/guilds/${normalizedGuildId}/members/${normalizedUserId}`,
    { headers: { Authorization: `Bot ${normalizedToken}` } }
  );

  return response.json();
}

export async function listGuildMembers(guildId, botToken, limit = 1000) {
  const normalizedGuildId = String(guildId || "").trim();
  const normalizedToken = String(botToken || "").trim();
  const pageSize = Math.min(Math.max(Number(limit) || 1000, 1), 1000);
  if (!normalizedGuildId || !normalizedToken) {
    throw new Error("缺少 Discord 伺服器或 Bot Token 設定");
  }

  const members = [];
  let after = "0";
  for (let page = 0; page < 10; page += 1) {
    const response = await discordFetch(
      `${DISCORD_API}/guilds/${normalizedGuildId}/members?limit=${pageSize}&after=${after}`,
      { headers: { Authorization: `Bot ${normalizedToken}` } }
    );
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("Discord 未回傳成員名單");
    members.push(...rows);
    if (rows.length < pageSize) break;
    after = String(rows.at(-1)?.user?.id || "");
    if (!after) break;
  }
  return members;
}

async function discordFetch(url, init, attempts = 3) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, init);

      if (response.ok) {
        return response;
      }

      const text = await response.text();

      if (
        response.status !== 429 &&
        response.status < 500
      ) {
        throw new Error(
          `Discord HTTP ${response.status}: ${text.slice(0, 500)}`
        );
      }

      let delay = 1000 * (attempt + 1);

      try {
        const payload = JSON.parse(text);
        if (payload.retry_after) {
          delay = Math.ceil(Number(payload.retry_after) * 1000);
        }
      } catch {}

      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 750 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("Discord API 呼叫失敗");
}

export async function editOriginalResponse(applicationId, token, content, options = {}) {
  const url =
    `${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`;

  await discordFetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: String(content || ""),
      ...(Array.isArray(options.components) ? { components: options.components } : {}),
      allowed_mentions: Array.isArray(options.allowedUserIds)
        ? { parse: [], users: options.allowedUserIds.map(String).slice(0, 100) }
        : { parse: [] }
    })
  });
}

export async function sendFollowup(
  applicationId,
  token,
  content
) {
  const url =
    `${DISCORD_API}/webhooks/${applicationId}/${token}`;

  await discordFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: String(content || ""),
      allowed_mentions: { parse: [] }
    })
  });
}

export async function sendLongReply(
  applicationId,
  token,
  content
) {
  const chunks = splitMessage(content, 1900);

  await editOriginalResponse(
    applicationId,
    token,
    chunks.shift() || "AI 未回傳內容。"
  );

  for (const chunk of chunks) {
    await sendFollowup(applicationId, token, chunk);
  }
}

export function splitMessage(content, limit = 1900) {
  const text = String(content || "");
  if (!text) return [""];

  const chunks = [];
  let remaining = text;

  while (remaining.length > limit) {
    let index = remaining.lastIndexOf("\n", limit);
    if (index < Math.floor(limit * 0.5)) {
      index = remaining.lastIndexOf("。", limit);
    }
    if (index < Math.floor(limit * 0.5)) {
      index = limit;
    }

    chunks.push(remaining.slice(0, index).trim());
    remaining = remaining.slice(index).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
