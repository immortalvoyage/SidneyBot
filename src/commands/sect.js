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
import { canViewMembers } from "../sect/permissions.js";

export async function handleSect(interaction, env) {
  const user = getUser(interaction);
  await ensureMaster(env, user);

  const member = await getMember(env, user.id);
  if (!member || !canViewMembers(member.rank)) {
    return immediateResponse(
      "❌ 只有仙遊者正式成員可以查看宗門狀態，請先使用 `/apply` 申請加入。",
      true
    );
  }

  const [members, pending] =
    await Promise.all([
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
