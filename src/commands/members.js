import { immediateResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { ensureMaster, getMember, listMembers } from "../sect/members.js";
import { canViewMembers } from "../sect/permissions.js";
import { rosterComponents, rosterContent } from "../interactions/roster.js";

export const PAGE_SIZE = 10;

function requestedPage(interaction) {
  return interaction.data?.options?.find(item => item.name === "page")?.value ?? 1;
}

export async function handleMembers(interaction, env) {
  const user = getUser(interaction);
  await ensureMaster(env, user);
  const actor = await getMember(env, user.id);
  if (!actor || !canViewMembers(actor.rank)) {
    return immediateResponse("❌ 只有仙遊者成員可以查看名冊。", true);
  }

  const members = await listMembers(env);
  if (!members.length) return immediateResponse("仙遊者名冊目前沒有資料。", true);

  const page = Number(requestedPage(interaction));
  const totalPages = Math.ceil(members.length / PAGE_SIZE);
  if (!Number.isInteger(page) || page < 1 || page > totalPages) {
    return immediateResponse(`❌ 頁碼超出範圍，名冊目前共有 ${totalPages} 頁。`, true);
  }

  return new Response(JSON.stringify({ type: 4, data: {
    content: rosterContent(members, page, env),
    components: rosterComponents(page, totalPages),
    flags: 64,
    allowed_mentions: { parse: [] }
  }}), { headers: { "Content-Type": "application/json; charset=UTF-8" } });
}
