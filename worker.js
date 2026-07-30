/**
 * ==========================================================
 * ☯【仙遊者】☯ Discord AI Bot
 * worker.js
 * Cloudflare Workers 原生 Ed25519 驗證版
 * ==========================================================
 */

import { handleCommand } from "./commands.js";

import {
  pingResponse,
  immediateResponse
} from "./discord.js";

import {
  logInfo,
  logError
} from "./logger.js";

/**
 * Cloudflare Worker 主程式
 */
export default {

  async fetch(request, env, ctx) {

    try {

      /**
       * 健康檢查
       */
      if (request.method === "GET") {

        return new Response(
          "☯【仙遊者】☯ Discord AI Bot Online",
          {
            status: 200,
            headers: {
              "Content-Type":
                "text/plain; charset=UTF-8"
            }
          }
        );

      }

      /**
       * 只接受 Discord POST 請求
       */
      if (request.method !== "POST") {

        return new Response(
          "Method Not Allowed",
          {
            status: 405,
            headers: {
              Allow: "GET, POST"
            }
          }
        );

      }

      /**
       * 讀取 Discord 驗證標頭
       */
      const signature =
        request.headers.get(
          "X-Signature-Ed25519"
        );

      const timestamp =
        request.headers.get(
          "X-Signature-Timestamp"
        );

      if (
        !signature ||
        !timestamp
      ) {

        logError(
          "Discord 驗證標頭不存在"
        );

        return new Response(
          "Missing Discord Signature",
          {
            status: 401
          }
        );

      }

      /**
       * 保留原始 Request Body
       *
       * Discord 簽章驗證必須使用：
       * timestamp + 原始 body
       */
      const rawBody =
        await request.text();

      /**
       * 驗證 Discord Ed25519 簽章
       */
      const verified =
        await verifyDiscordRequest(
          rawBody,
          signature,
          timestamp,
          env.DISCORD_PUBLIC_KEY
        );

      if (!verified) {

        logError(
          "Discord Ed25519 簽章驗證失敗"
        );

        return new Response(
          "Invalid Request Signature",
          {
            status: 401
          }
        );

      }

      /**
       * 解析 Discord Interaction
       */
      let interaction;

      try {

        interaction =
          JSON.parse(rawBody);

      } catch (error) {

        logError(
          "Discord JSON 解析失敗",
          error
        );

        return new Response(
          "Invalid JSON",
          {
            status: 400
          }
        );

      }

      logInfo(
        `Interaction Type: ${interaction.type}`
      );

      /**
       * Discord Interaction 類型
       */
      switch (interaction.type) {

        /**
         * Discord Endpoint 驗證 Ping
         */
        case 1:

          return pingResponse();

        /**
         * Slash Command
         */
        case 2:

          return await handleCommand(
            interaction,
            env,
            ctx
          );

        /**
         * 尚未支援的 Interaction
         */
        default:

          return immediateResponse(
            "目前尚未支援此 Interaction。"
          );

      }

    } catch (error) {

      logError(
        "Worker 執行錯誤",
        error
      );

      return new Response(
        JSON.stringify({
          error: true,
          message:
            "Internal Server Error"
        }),
        {
          status: 500,
          headers: {
            "Content-Type":
              "application/json; charset=UTF-8"
          }
        }
      );

    }

  }

};

/**
 * ==========================================================
 * 驗證 Discord Ed25519 簽章
 * ==========================================================
 *
 * @param {string} body
 * @param {string} signatureHex
 * @param {string} timestamp
 * @param {string} publicKeyHex
 * @returns {Promise<boolean>}
 */
async function verifyDiscordRequest(
  body,
  signatureHex,
  timestamp,
  publicKeyHex
) {

  try {

    if (
      !body ||
      !signatureHex ||
      !timestamp ||
      !publicKeyHex
    ) {

      return false;

    }

    const publicKeyBytes =
      hexToUint8Array(
        publicKeyHex.trim()
      );

    const signatureBytes =
      hexToUint8Array(
        signatureHex.trim()
      );

    const messageBytes =
      new TextEncoder().encode(
        timestamp + body
      );

    /**
     * Discord Public Key 為原始 32-byte
     * Ed25519 公開金鑰
     */
    const publicKey =
      await crypto.subtle.importKey(
        "raw",
        publicKeyBytes,
        {
          name: "Ed25519"
        },
        false,
        ["verify"]
      );

    return await crypto.subtle.verify(
      {
        name: "Ed25519"
      },
      publicKey,
      signatureBytes,
      messageBytes
    );

  } catch (error) {

    logError(
      "Ed25519 驗證程序發生錯誤",
      error
    );

    return false;

  }

}

/**
 * ==========================================================
 * 十六進位字串轉 Uint8Array
 * ==========================================================
 *
 * @param {string} hex
 * @returns {Uint8Array}
 */
function hexToUint8Array(hex) {

  if (
    typeof hex !== "string" ||
    hex.length === 0 ||
    hex.length % 2 !== 0 ||
    !/^[0-9a-fA-F]+$/.test(hex)
  ) {

    throw new Error(
      "無效的十六進位字串"
    );

  }

  const result =
    new Uint8Array(
      hex.length / 2
    );

  for (
    let index = 0;
    index < hex.length;
    index += 2
  ) {

    result[index / 2] =
      Number.parseInt(
        hex.substring(
          index,
          index + 2
        ),
        16
      );

  }

  return result;

}