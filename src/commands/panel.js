import {
  deferredResponse,
  deleteOriginalResponse,
  immediateResponse,
  sendChannelMessage
} from "../../discord.js";
import { getUser } from "../../utils.js";
import { resolveActor } from "../sect/service.js";
import { canApprove } from "../sect/permissions.js";
import { dailyGreetingComponents, masterAdminPanelComponents } from "../interactions/components.js";
import { isSectMaster } from "../sect/permissions.js";
import { isMasterAdminChannel } from "../platform/channels.js";

export async function handlePanel(interaction, env, ctx) {
  try {
    const actor = await resolveActor(env, getUser(interaction));
    const panelType = interaction.data?.options?.find(option => option.name === "type")?.value;
    const isAdminChannel = isMasterAdminChannel(interaction.channel_id);
    const wantsAdminPanel = panelType === "admin" || (!panelType && isAdminChannel);

    if (wantsAdminPanel) {
      if (!actor || !isSectMaster(actor.userId, env)) throw new Error("只有宗主可以建立宗主管理面板");
      if (!isAdminChannel) throw new Error("宗主管理面板只能建立在宗主審批私人頻道");
      await sendChannelMessage(interaction.channel_id, env.DISCORD_BOT_TOKEN, [
        "## ☯ 仙遊者｜宗主管理中心",
        "管理成員名冊、燕雲 UID 與宗門身分。",
        "",
        "**成員與身分**",
        "新增領民・綁定 UID・晉升或調整身分",
        "",
        "**名冊與紀錄**",
        "查看成員資料・查閱最近操作・重新整理面板",
        "",
        "> 所有操作都會再次驗證宗主身分並寫入紀錄。",
        "> 綁定 UID 後升為門徒；退出百業時保留 UID 與歷史資料。"
      ].join("\n"), { components: masterAdminPanelComponents() });
      acknowledgePanelCreated(interaction, ctx);
      return deferredResponse(true);
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
    acknowledgePanelCreated(interaction, ctx);
    return deferredResponse(true);
  } catch (error) {
    return immediateResponse(`❌ ${error.message || "面板建立失敗"}`, true);
  }
}


function acknowledgePanelCreated(interaction, ctx) {
  const task = deleteOriginalResponse(
    interaction.application_id,
    interaction.token
  );

  if (ctx?.waitUntil) {
    ctx.waitUntil(task);
    return;
  }

  task.catch(() => {});
}
