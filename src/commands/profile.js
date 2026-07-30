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

export async function handleProfile(interaction, env) {
  const user = getUser(interaction);
  const guildId = interaction.guild_id || "dm";

  await ensureMaster(env, user);

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
