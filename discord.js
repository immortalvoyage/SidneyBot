const DISCORD_API = "https://discord.com/api/v10";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}

export function immediateResponse(content, ephemeral = false) {
  return json({
    type: 4,
    data: {
      content: String(content || ""),
      flags: ephemeral ? 64 : 0,
      allowed_mentions: { parse: [] }
    }
  });
}

export function deferredResponse(ephemeral = false) {
  return json({
    type: 5,
    data: {
      flags: ephemeral ? 64 : 0
    }
  });
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

export async function editOriginalResponse(
  applicationId,
  token,
  content
) {
  const url =
    `${DISCORD_API}/webhooks/${applicationId}/${token}/messages/@original`;

  await discordFetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: String(content || ""),
      allowed_mentions: { parse: [] }
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
