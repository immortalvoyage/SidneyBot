import { immediateResponse } from "../../discord.js";
import {
  getOptionValue,
  getUser
} from "../../utils.js";

import { resolveActor, rejectApplicant } from "../sect/service.js";

export async function handleReject(interaction, env) {
  const actorUser = getUser(interaction);
  const actor = await resolveActor(env, actorUser);

  const targetUserId = String(
    getOptionValue(interaction, "user_id") || ""
  ).trim();

  const note = String(
    getOptionValue(interaction, "note") || ""
  ).trim();

  if (!targetUserId) {
    return immediateResponse(
      "❌ 請輸入申請者 Discord User ID。",
      true
    );
  }

  try {
    await rejectApplicant(
      env,
      actor,
      targetUserId,
      note
    );

    return immediateResponse(
      [
        "✅ 已拒絕入宗申請。",
        `Discord ID：${targetUserId}`,
        `備註：${note || "無"}`
      ].join("\n"),
      true
    );
  } catch (error) {
    return immediateResponse(
      `❌ ${error.message}`,
      true
    );
  }
}
