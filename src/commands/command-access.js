import { RANK, RANK_LABEL } from "../sect/constants.js";

const ACCESS_KEY = "discord:command-access:v1";

export const COMMAND_CATALOG = Object.freeze([
  { name: "ai", label: "老祖問答", description: "公開向老祖提問", roles: [RANK.RESIDENT, RANK.DISCIPLE, RANK.ELDER, RANK.MASTER], help: "basic" },
  { name: "apply", label: "入宗申請", description: "私密申請加入宗門", roles: [RANK.OUTSIDER], help: "basic" },
  { name: "review", label: "入宗審核", description: "審核入宗申請", roles: [RANK.ELDER, RANK.MASTER], help: "review" },
  { name: "panel", label: "互動面板", description: "建立請安或宗主管理面板", roles: [RANK.ELDER, RANK.MASTER], help: "review" },
  { name: "members", label: "宗門名冊", description: "查看宗門成員名冊", roles: [RANK.RESIDENT, RANK.DISCIPLE, RANK.ELDER, RANK.MASTER], help: "basic" },
  { name: "member", label: "成員管理", description: "查看與調整宗門成員", roles: [RANK.MASTER], help: "admin" },
  { name: "sect", label: "宗門狀態", description: "查看仙遊者宗門狀態", roles: [RANK.RESIDENT, RANK.DISCIPLE, RANK.ELDER, RANK.MASTER], help: "basic" },
  { name: "profile", label: "個人資料", description: "查看或修改個人宗門資料", roles: [RANK.OUTSIDER, RANK.RESIDENT, RANK.DISCIPLE, RANK.ELDER, RANK.MASTER], help: "basic" },
  { name: "forget", label: "清除記憶", description: "清除自己的 AI 對話記憶", roles: [RANK.OUTSIDER, RANK.RESIDENT, RANK.DISCIPLE, RANK.ELDER, RANK.MASTER], help: "basic" },
  { name: "game", label: "遊戲綁定", description: "燕雲角色綁定與審核", roles: [RANK.RESIDENT, RANK.DISCIPLE, RANK.ELDER, RANK.MASTER], help: "game" },
  { name: "audit", label: "操作紀錄", description: "查看仙遊者操作紀錄", roles: [RANK.MASTER], help: "admin" },
  { name: "laozu", label: "老祖功能", description: "媒合、刊登與宗門處置", roles: [RANK.RESIDENT, RANK.DISCIPLE, RANK.ELDER, RANK.MASTER], help: "basic" },
  { name: "system", label: "系統維護", description: "檢查與修復資料索引", roles: [RANK.MASTER], help: "system" },
  { name: "help", label: "指令說明", description: "以按鈕查看可用指令", roles: [RANK.OUTSIDER, RANK.RESIDENT, RANK.DISCIPLE, RANK.ELDER, RANK.MASTER], help: "basic" }
]);

export const EDITABLE_RANKS = Object.freeze([
  RANK.OUTSIDER, RANK.RESIDENT, RANK.DISCIPLE, RANK.ELDER, RANK.MASTER
]);

function normalizedRank(rank) {
  return rank || RANK.OUTSIDER;
}

async function overrides(env) {
  if (!env?.BOT_MEMORY) return {};
  return await env.BOT_MEMORY.get(ACCESS_KEY, "json") || {};
}

export async function listCommandPolicies(env) {
  const saved = await overrides(env);
  return COMMAND_CATALOG.map(command => ({
    ...command,
    allowedRoles: [...command.roles],
    roles: Array.isArray(saved[command.name]) ? saved[command.name].filter(role => EDITABLE_RANKS.includes(role)) : [...command.roles]
  }));
}

export async function getCommandPolicy(env, commandName) {
  return (await listCommandPolicies(env)).find(command => command.name === commandName) || null;
}

export async function canUseCommand(env, commandName, rank) {
  if (commandName === "help") return true;
  const policy = await getCommandPolicy(env, commandName);
  return !policy || policy.roles.includes(normalizedRank(rank));
}

export async function resetCommandRoles(env, commandName) {
  const command = COMMAND_CATALOG.find(item => item.name === commandName);
  if (!command) throw new Error("找不到指定指令");
  const saved = await overrides(env);
  delete saved[commandName];
  await env.BOT_MEMORY.put(ACCESS_KEY, JSON.stringify(saved));
  return { ...command, allowedRoles: [...command.roles], roles: [...command.roles] };
}

export async function setCommandRoles(env, commandName, roles) {
  const command = COMMAND_CATALOG.find(item => item.name === commandName);
  if (!command) throw new Error("找不到指定指令");
  const normalized = [...new Set((roles || []).filter(role => command.roles.includes(role)))];
  if (!normalized.length) throw new Error("至少保留一個可使用身分");
  const saved = await overrides(env);
  saved[commandName] = normalized;
  await env.BOT_MEMORY.put(ACCESS_KEY, JSON.stringify(saved));
  return { ...command, allowedRoles: [...command.roles], roles: normalized };
}

export function rankLabel(rank) {
  return rank === RANK.OUTSIDER ? "尚未入宗" : (RANK_LABEL[rank] || rank);
}
