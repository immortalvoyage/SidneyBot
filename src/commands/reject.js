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
    getOptionValue(interaction, "applicant") || ""
  ).trim();

  const note = String(
    getOptionValue(interaction, "note") || ""
  ).trim();

  if (!targetUserId) {
    return immediateResponse(
      "❌ 請從待審申請選單選擇申請者。",
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
