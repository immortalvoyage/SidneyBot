import { immediateResponse, sendChannelMessage } from "../../discord.js";
import { getUser } from "../../utils.js";
import { resolveActor } from "../sect/service.js";
import { canApprove } from "../sect/permissions.js";
import { dailyGreetingComponents, masterAdminPanelComponents } from "../interactions/components.js";
import { isSectMaster } from "../sect/permissions.js";

export async function handlePanel(interaction, env) {
  try {
    const actor = await resolveActor(env, getUser(interaction));
    const panelType = interaction.data?.options?.find(option => option.name === "type")?.value;
    const isAdminChannel = String(interaction.channel_id || "") === String(env.MASTER_ADMIN_CHANNEL_ID || "");
    const wantsAdminPanel = panelType === "admin" || (!panelType && isAdminChannel);

    if (wantsAdminPanel) {
      if (!actor || !isSectMaster(actor.userId, env)) throw new Error("只有宗主可以建立宗主管理面板");
      if (!isAdminChannel) throw new Error("宗主管理面板只能建立在宗主審批私人頻道");
      await sendChannelMessage(interaction.channel_id, env.DISCORD_BOT_TOKEN, [
        "☯ **仙遊者・宗主管理面板**",
        "手機可直接使用按鈕與玩家選單；所有操作都會再次驗證宗主身分並寫入操作紀錄。",
        "UID 綁定會將領民升為門徒；退出百業會降為領民但保留 UID 與歷史資料。"
      ].join("\n"), { components: masterAdminPanelComponents() });
      return immediateResponse("✅ 宗主管理面板已建立。", true);
    }
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
