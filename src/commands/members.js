import { immediateResponse } from "../../discord.js";
import { getUser } from "../../utils.js";

import {
  listMembers,
  ensureMaster,
  getMember
} from "../sect/members.js";

import {
  canViewMembers
} from "../sect/permissions.js";

import {
  RANK_LABEL
} from "../sect/constants.js";

export async function handleMembers(interaction, env) {
  const user = getUser(interaction);
  await ensureMaster(env, user);

  const actor = await getMember(env, user.id);

  if (!actor || !canViewMembers(actor.rank)) {
    return immediateResponse(
      "❌ 只有宗門成員可以查看名冊。",
      true
    );
  }

  const members = await listMembers(env);

  if (!members.length) {
    return immediateResponse(
      "宗門名冊目前沒有資料。",
      true
    );
  }

  const rows = members.map((member, index) =>
    `${index + 1}. ${member.displayName}｜` +
    `${RANK_LABEL[member.rank] || member.rank}｜` +
    `${member.userId}`
  );

  return immediateResponse(
    [
      `## ${env.SECT_NAME || "☯【仙遊者】☯"} 名冊`,
      "",
      ...rows
    ].join("\n"),
    true
  );
}
