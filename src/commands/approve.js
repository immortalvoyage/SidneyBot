import { immediateResponse } from "../../discord.js";
import {
  getOptionValue,
  getUser
} from "../../utils.js";

import { resolveActor, approveApplicant } from "../sect/service.js";

export async function handleApprove(interaction, env) {
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
    const member = await approveApplicant(
      env,
      actor,
      targetUserId,
      note
    );

    return immediateResponse(
      [
        "✅ 已批准入宗。",
        `成員：${member.displayName}`,
        `Discord ID：${member.userId}`,
        `身分：${member.rank}`
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
