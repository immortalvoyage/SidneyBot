import {
  deferredResponse,
  editOriginalResponse,
  immediateResponse
} from "../../discord.js";
import { formatError } from "../../utils.js";
import { logError } from "../../logger.js";

export async function runDeferredCommand(
  interaction,
  ctx,
  operationName,
  task
) {
  if (!ctx?.waitUntil) {
    try {
      return immediateResponse(await task(), true);
    } catch (error) {
      return immediateResponse(`❌ ${formatError(error)}`, true);
    }
  }

  ctx.waitUntil((async () => {
    try {
      const content = await task();
      await editOriginalResponse(
        interaction.application_id,
        interaction.token,
        content
      );
    } catch (error) {
      logError(`${operationName} 背景執行失敗`, error);
      try {
        await editOriginalResponse(
          interaction.application_id,
          interaction.token,
          `❌ ${formatError(error)}`
        );
      } catch (replyError) {
        logError(`${operationName} 錯誤訊息回覆失敗`, replyError);
      }
    }
  })());

  return deferredResponse(true);
}
