import { immediateResponse } from "../../discord.js";
import { getUser } from "../../utils.js";

import {
  ensureMaster,
  getMember,
  listMembers,
  formatMember
} from "../sect/members.js";

import {
  listApplications
} from "../sect/applications.js";

export async function handleSect(interaction, env) {
  const user = getUser(interaction);
  await ensureMaster(env, user);

  const [member, members, pending] =
    await Promise.all([
      getMember(env, user.id),
      listMembers(env),
      listApplications(env)
    ]);

  return immediateResponse(
    [
      `## ${env.SECT_NAME || "☯【仙遊者】☯"}`,
      "",
      `宗門版本：V${env.APP_VERSION || "4.2.3"}`,
      `正式成員：${members.length}`,
      `待審申請：${pending.length}`,
      "",
      "### 我的宗門資料",
      formatMember(member)
    ].join("\n"),
    true
  );
}
