import { listCommandPolicies, setCommandRoles, rankLabel } from "../commands/command-access.js";

export function commandPolicyListComponents(policies) {
  const options = policies.slice(0, 25).map(command => ({
    label: `/${command.name}　${command.label}`.slice(0, 100),
    description: command.roles.map(rankLabel).join("、").slice(0, 100),
    value: command.name
  }));
  return [{ type: 1, components: [{ type: 3, custom_id: "sidney:admin:v1:command-select", placeholder: "選擇要修改的指令", min_values: 1, max_values: 1, options }] }];
}

export function commandRoleComponents(policy) {
  return [
    { type: 1, components: [{
      type: 3,
      custom_id: `sidney:admin:v1:command-roles:${policy.name}`,
      placeholder: "選擇可使用的身分組",
      min_values: 1,
      max_values: policy.allowedRoles.length,
      options: policy.allowedRoles.map(rank => ({ label: rankLabel(rank), value: rank, default: policy.roles.includes(rank) }))
    }] },
    { type: 1, components: [{ type: 2, style: 2, custom_id: "sidney:admin:v1:command-permissions", label: "返回指令總表", emoji: { name: "↩️" } }] }
  ];
}

export function commandPolicyText(policy) {
  return [
    `## ⚙️ 指令權限｜/${policy.name}`,
    `功能：${policy.label} — ${policy.description}`,
    `可使用身分：**${policy.roles.map(rankLabel).join("、")}**`,
    `刊登位置：**/help → ${helpLabel(policy.help)}**`,
    "",
    "下方可直接複選安全範圍內的身分；儲存後會同步影響實際執行權限與 /help 顯示。"
  ].join("\n");
}

export async function commandPolicyList(env) {
  const policies = await listCommandPolicies(env);
  return {
    content: [
      "## ⚙️ 仙遊者｜指令與身分權限",
      `目前共 **${policies.length}** 個主指令；下列身分為實際可執行權限。`,
      "",
      ...policies.map(command => `**/${command.name}**　${command.label}\n可用：${command.roles.map(rankLabel).join("、")}｜Help：${helpLabel(command.help)}`),
      "",
      "> 選擇任一指令即可直接修改可使用身分組。"
    ].join("\n"),
    components: commandPolicyListComponents(policies)
  };
}

export async function selectCommandPolicy(env, commandName) {
  const policy = (await listCommandPolicies(env)).find(command => command.name === commandName);
  if (!policy) throw new Error("找不到指定指令");
  return { content: commandPolicyText(policy), components: commandRoleComponents(policy) };
}

export async function updateCommandPolicy(env, commandName, roles) {
  const policy = await setCommandRoles(env, commandName, roles);
  return { content: `✅ 指令權限已儲存。\n\n${commandPolicyText(policy)}`, components: commandRoleComponents(policy) };
}

function helpLabel(topic) {
  return ({ basic: "日常功能", game: "遊戲綁定", review: "審核工作", admin: "宗主管理", system: "系統維護" })[topic] || topic;
}
