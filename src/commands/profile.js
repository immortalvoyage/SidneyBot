import { immediateResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import {
  loadProfile,
  formatProfile
} from "../../memory.js";

import {
  ensureMaster,
  getMember,
  formatMember
} from "../sect/members.js";
import {
  resolveActor,
  setOwnDisplayName
} from "../sect/service.js";

function subcommand(interaction) {
  return interaction?.data?.options?.[0] || null;
}

function subOption(interaction, name) {
  return subcommand(interaction)?.options?.find(
    item => item.name === name
  )?.value;
}

export async function handleProfile(interaction, env) {
  const user = getUser(interaction);
  const guildId = interaction.guild_id || "dm";
  const action = subcommand(interaction)?.name || "view";

  await ensureMaster(env, user);

  if (action === "set-name") {
    try {
      const actor = await resolveActor(env, user);
      const updated = await setOwnDisplayName(
        env,
        actor,
        subOption(interaction, "name")
      );

      return immediateResponse(
        [
          "✅ 已更新仙遊者顯示名稱。",
          `新名稱：${updated.displayName}`,
          "Discord 帳號名稱與《燕雲十六聲》角色名稱不會受到影響。"
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

  if (action !== "view") {
    return immediateResponse(
      "❌ 不支援的 /profile 子指令。",
      true
    );
  }

  const [profile, member] = await Promise.all([
    loadProfile(env, guildId, user.id),
    getMember(env, user.id)
  ]);

  return immediateResponse(
    [
      "## 個人資料",
      formatProfile(profile),
      "",
      "## 宗門資料",
      formatMember(member)
    ].join("\n"),
    true
  );
}
