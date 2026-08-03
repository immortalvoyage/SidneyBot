import { handleCommand } from "./commands.js";
import { logError } from "./logger.js";
import { handlePlatformApi } from "./src/platform/games/api.js";
import { handleMemberAutocomplete } from "./src/commands/member-autocomplete.js";
import { handleApplicationAutocomplete } from "./src/commands/application-autocomplete.js";
import { handleGameBindingAutocomplete } from "./src/commands/game-binding-autocomplete.js";
import { handleAuditAutocomplete } from "./src/commands/audit-autocomplete.js";

const PING = 1;
const APPLICATION_COMMAND = 2;
const APPLICATION_COMMAND_AUTOCOMPLETE = 4;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const apiResponse = await handlePlatformApi(request, env, url);
    if (apiResponse) return apiResponse;

    if (request.method === "GET" && url.pathname === "/") {
      return new Response(
        `${env.SECT_NAME || "☯【仙遊者】☯"} Bot V${env.APP_VERSION || "4.2.4"} is running.`
      );
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405
      });
    }

    const rawBody = await request.text();

    const valid = await verifyDiscordRequest(
      request,
      rawBody,
      env.DISCORD_PUBLIC_KEY
    );

    if (!valid) {
      return new Response("Invalid request signature", {
        status: 401
      });
    }

    let interaction;

    try {
      interaction = JSON.parse(rawBody);
    } catch {
      return new Response("Invalid JSON", {
        status: 400
      });
    }

    if (interaction.type === PING) {
      return json({ type: 1 });
    }

    if (interaction.type === APPLICATION_COMMAND_AUTOCOMPLETE) {
      if (["approve", "reject"].includes(interaction.data?.name)) {
        return handleApplicationAutocomplete(interaction, env);
      }
      if (interaction.data?.name === "game") {
        return handleGameBindingAutocomplete(interaction, env);
      }
      if (interaction.data?.name === "audit") {
        return handleAuditAutocomplete(interaction, env);
      }
      return handleMemberAutocomplete(interaction, env);
    }

    if (interaction.type !== APPLICATION_COMMAND) {
      return json({
        type: 4,
        data: {
          content: "目前只支援 Slash Commands。",
          flags: 64
        }
      });
    }

    try {
      return await handleCommand(
        interaction,
        env,
        ctx
      );
    } catch (error) {
      logError("未捕捉的 Interaction 錯誤", error);

      return json({
        type: 4,
        data: {
          content: "❌ 系統發生未預期錯誤。",
          flags: 64
        }
      });
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}

async function verifyDiscordRequest(
  request,
  body,
  publicKey
) {
  if (!publicKey) return false;

  const signature =
    request.headers.get("X-Signature-Ed25519");

  const timestamp =
    request.headers.get("X-Signature-Timestamp");

  if (!signature || !timestamp) {
    return false;
  }

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      hexToBytes(publicKey),
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    const message =
      new TextEncoder().encode(timestamp + body);

    return await crypto.subtle.verify(
      "Ed25519",
      key,
      hexToBytes(signature),
      message
    );
  } catch {
    return false;
  }
}

function hexToBytes(hex) {
  const clean = String(hex || "").trim();

  if (!/^[0-9a-f]+$/i.test(clean) || clean.length % 2) {
    throw new Error("Invalid hex");
  }

  const bytes = new Uint8Array(clean.length / 2);

  for (let index = 0; index < clean.length; index += 2) {
    bytes[index / 2] = parseInt(clean.slice(index, index + 2), 16);
  }

  return bytes;
}
