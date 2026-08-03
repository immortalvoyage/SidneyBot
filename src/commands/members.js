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

const PAGE_SIZE = 15;

function requestedPage(interaction) {
  const option = interaction.data?.options
    ?.find(item => item.name === "page");
  return option?.value ?? 1;
}

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

  const page = Number(requestedPage(interaction));
  const totalPages = Math.ceil(members.length / PAGE_SIZE);

  if (!Number.isInteger(page) || page < 1 || page > totalPages) {
    return immediateResponse(
      `❌ 頁碼超出範圍，名冊目前共有 ${totalPages} 頁。`,
      true
    );
  }

  const offset = (page - 1) * PAGE_SIZE;
  const visibleMembers = members.slice(offset, offset + PAGE_SIZE);

  const rows = visibleMembers.map((member, index) =>
    `${offset + index + 1}. ${member.displayName}｜` +
    `${RANK_LABEL[member.rank] || member.rank}｜` +
    `${member.userId}`
  );

  return immediateResponse(
    [
      `## ${env.SECT_NAME || "☯【仙遊者】☯"} 名冊`,
      `第 ${page}/${totalPages} 頁｜共 ${members.length} 人`,
      "",
      ...rows,
      "",
      page < totalPages
        ? `下一頁：\`/members page:${page + 1}\``
        : "已是最後一頁。"
    ].join("\n"),
    true
  );
}

export { PAGE_SIZE };
