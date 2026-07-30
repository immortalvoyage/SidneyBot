import { immediateResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { clearUserMemory } from "../../memory.js";
import { writeAudit } from "../sect/audit.js";

export async function handleForget(interaction, env) {
  const user = getUser(interaction);
  const guildId = interaction.guild_id || "dm";

  await clearUserMemory(
    env,
    guildId,
    user.id
  );

  await writeAudit(env, {
    action: "memory.cleared",
    actorId: user.id,
    targetId: user.id
  });

  return immediateResponse(
    "✅ 已清除你的聊天記憶與個人資料；宗門成員身分不受影響。",
    true
  );
}
