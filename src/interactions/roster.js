import { immediateResponse, updateMessageResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { getGameAccountByUser } from "../platform/games/service.js";
import { GAME_IDS } from "../platform/games/constants.js";
import { RANK, RANK_LABEL } from "../sect/constants.js";
import { ensureMaster, getMember, listMembers } from "../sect/members.js";
import { canViewMembers } from "../sect/permissions.js";

export const ROSTER_PREFIX = "sidney:roster:v1";
export const ROSTER_PAGE_SIZE = 10;
const FIND_PAGE_SIZE = 25;
const GROUPS = [RANK.MASTER, RANK.ELDER, RANK.DISCIPLE, RANK.RESIDENT];
const ICON = { [RANK.MASTER]: "👑", [RANK.ELDER]: "🌙", [RANK.DISCIPLE]: "⚔️", [RANK.RESIDENT]: "🌱" };

export function isRosterInteraction(customId) {
  return String(customId || "").startsWith(`${ROSTER_PREFIX}:`);
}

export function rosterContent(members, page, env) {
  const totalPages = Math.max(1, Math.ceil(members.length / ROSTER_PAGE_SIZE));
  const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const visible = members.slice((safePage - 1) * ROSTER_PAGE_SIZE, safePage * ROSTER_PAGE_SIZE);
  const counts = Object.fromEntries(GROUPS.map(rank => [rank, members.filter(member => member.rank === rank).length]));
  const lines = [
    `## ${env.SECT_NAME || "☯【仙遊者】☯"} 名冊`,
    `共 ${members.length} 人`,
    `宗主 ${counts.master}｜長老 ${counts.elder}｜門徒 ${counts.disciple}｜領民 ${counts.resident}`,
    ""
  ];
  for (const rank of GROUPS) {
    const rows = visible.filter(member => member.rank === rank);
    if (!rows.length) continue;
    lines.push(`### 【${RANK_LABEL[rank]}】`);
    for (const member of rows) lines.push(`${ICON[rank]} ${member.displayName || member.username || "未命名成員"}`);
    lines.push("");
  }
  lines.push(`第 ${safePage}/${totalPages} 頁`);
  return lines.join("\n");
}

export function rosterComponents(page, totalPages) {
  return [{ type: 1, components: [
    { type: 2, style: 2, custom_id: `${ROSTER_PREFIX}:page:${page - 1}`, label: "上一頁", emoji: { name: "◀️" }, disabled: page <= 1 },
    { type: 2, style: 2, custom_id: `${ROSTER_PREFIX}:page:${page + 1}`, label: "下一頁", emoji: { name: "▶️" }, disabled: page >= totalPages },
    { type: 2, style: 1, custom_id: `${ROSTER_PREFIX}:find:0`, label: "查找玩家", emoji: { name: "🔍" } },
    { type: 2, style: 2, custom_id: `${ROSTER_PREFIX}:refresh:${page}`, label: "重新整理", emoji: { name: "🔄" } }
  ] }];
}

function findComponents(members, page) {
  const pageCount = Math.max(1, Math.ceil(members.length / FIND_PAGE_SIZE));
  const safePage = Math.min(Math.max(Number(page) || 0, 0), pageCount - 1);
  const options = members.slice(safePage * FIND_PAGE_SIZE, (safePage + 1) * FIND_PAGE_SIZE).map(member => ({
    label: String(member.displayName || member.username || member.userId).slice(0, 100),
    description: RANK_LABEL[member.rank] || member.rank,
    value: String(member.userId)
  }));
  const rows = [{ type: 1, components: [{ type: 3, custom_id: `${ROSTER_PREFIX}:select:${safePage}`, placeholder: "依名稱選擇玩家", min_values: 1, max_values: 1, options }] }];
  if (pageCount > 1) rows.push({ type: 1, components: [
    { type: 2, style: 2, custom_id: `${ROSTER_PREFIX}:find:${safePage - 1}`, label: "上一頁", disabled: safePage === 0 },
    { type: 2, style: 2, custom_id: `${ROSTER_PREFIX}:find:${safePage + 1}`, label: "下一頁", disabled: safePage >= pageCount - 1 }
  ] });
  return rows;
}

export async function handleRosterInteraction(interaction, env) {
  const actorUser = getUser(interaction);
  await ensureMaster(env, actorUser);
  const actor = await getMember(env, actorUser.id);
  if (!actor || !canViewMembers(actor.rank)) return immediateResponse("❌ 只有仙遊者成員可以查看名冊。", true);

  const members = await listMembers(env);
  const parts = String(interaction.data?.custom_id || "").split(":");
  const action = parts[3];
  const value = Number(parts[4] || 0);
  if (action === "find") {
    return updateMessageResponse({ content: `## 🔍 查找仙遊者成員\n共 ${members.length} 人｜第 ${value + 1}/${Math.max(1, Math.ceil(members.length / FIND_PAGE_SIZE))} 頁`, components: findComponents(members, value) });
  }
  if (action === "select") {
    const target = await getMember(env, interaction.data?.values?.[0]);
    if (!target) return immediateResponse("❌ 該玩家已不在仙遊者名冊中。", true);
    const account = await getGameAccountByUser(env, GAME_IDS.WWM, target.userId);
    return updateMessageResponse({ content: [
      "## 🔍 玩家資料", `名稱：${target.displayName || target.username}`, `身分：${RANK_LABEL[target.rank] || target.rank}`,
      `遊戲名稱：${account?.currentCharacterName || "尚未綁定"}`, `UID：${account?.uid || "尚未綁定"}`
    ].join("\n"), components: [{ type: 1, components: [{ type: 2, style: 2, custom_id: `${ROSTER_PREFIX}:refresh:1`, label: "返回名冊", emoji: { name: "↩️" } }] }] });
  }
  const page = action === "page" || action === "refresh" ? Math.max(1, value) : 1;
  const totalPages = Math.max(1, Math.ceil(members.length / ROSTER_PAGE_SIZE));
  return updateMessageResponse({ content: rosterContent(members, page, env), components: rosterComponents(Math.min(page, totalPages), totalPages) });
}
