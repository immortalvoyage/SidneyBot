import { immediateResponse, sendChannelMessage } from "../../discord.js";
import { getUser } from "../../utils.js";
import { resolveActor } from "../sect/service.js";
import { canApprove } from "../sect/permissions.js";
import { dailyGreetingComponents } from "../interactions/components.js";

export async function handlePanel(interaction, env) {
  try {
    const actor = await resolveActor(env, getUser(interaction));
    if (!actor || !canApprove(actor.rank)) {
      throw new Error("只有宗主或長老可以建立請安面板");
    }

    await sendChannelMessage(
      interaction.channel_id,
      env.DISCORD_BOT_TOKEN,
      [
        "☯ **老祖每日請安**",
        "每日可向老祖請安一次，點擊下方按鈕即可完成，無須輸入指令。",
        "系統依台灣時間結算，重複點擊不會重複增加好感。"
      ].join("\n"),
      { components: dailyGreetingComponents() }
    );
    return immediateResponse("✅ 每日請安面板已建立在目前頻道。", true);
  } catch (error) {
    return immediateResponse(`❌ ${error.message || "面板建立失敗"}`, true);
  }
}
