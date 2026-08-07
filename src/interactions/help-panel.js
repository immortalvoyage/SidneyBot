import { componentResponse, updateMessageResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { ensureMaster, getMember } from "../sect/members.js";
import { listCommandPolicies, rankLabel } from "./command-access.js";

export const HELP_PREFIX = "immortalvoyage:help:v1:";

export async function handleHelp(interaction, env) {
  const user = getUser(interaction);
  await ensureMaster(env, user);
  const member = await getMember(env, user.id);
  return componentResponse(...await helpView(env, member?.rank || null, "home"));
}

export function isHelpInteraction(customId) {
  return String(customId || "").startsWith(HELP_PREFIX);
}

export async function handleHelpInteraction(interaction, env) {
  const user = getUser(interaction);
  await ensureMaster(env, user);
  const member = await getMember(env, user.id);
  const topic = String(interaction.data?.custom_id || "").slice(HELP_PREFIX.length) || "home";
  const [content, components] = await helpView(env, member?.rank || null, topic);
  return updateMessageResponse({ content, components });
}

async function helpView(env, rank, topic) {
  const policies = await listCommandPolicies(env);
  const actorRank = rank || "outsider";
  const available = policies.filter(command => command.roles.includes(actorRank));
  const topics = [
    ["basic", "日常功能", "✨"],
    ["game", "遊戲綁定", "🎮"],
    ["review", "審核工作", "✅"],
    ["admin", "宗主管理", "👑"],
    ["system", "系統維護", "🛠️"]
  ].filter(([key]) => available.some(command => command.help === key));

  const selected = topic === "home" ? available : available.filter(command => command.help === topic);
  const title = topic === "home" ? "可使用指令" : (topics.find(([key]) => key === topic)?.[1] || "可使用指令");
  const rows = selected.map(command => `**/${command.name}　${command.label}**\n${command.description}`);

  const components = [];
  for (let index = 0; index < topics.length; index += 5) {
    components.push({
      type: 1,
      components: topics.slice(index, index + 5).map(([key, label, emoji]) => ({
        type: 2,
        style: topic === key ? 1 : 2,
        custom_id: `${HELP_PREFIX}${key}`,
        label,
        emoji: { name: emoji }
      }))
    });
  }
  if (topic !== "home") {
    components.push({ type: 1, components: [{ type: 2, style: 2, custom_id: `${HELP_PREFIX}home`, label: "全部可用指令", emoji: { name: "↩️" } }] });
  }

  return [[
    `## ☯ ${env.SECT_NAME || "仙遊者"}｜指令中心`,
    `身分：**${rankLabel(actorRank)}**　・　分類：**${title}**`,
    "",
    rows.length ? rows.join("\n\n") : "目前沒有可顯示的指令。",
    "",
    "> 此清單依你的身分即時計算，只有你看得到。"
  ].join("\n"), components];
}
