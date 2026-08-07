import { componentResponse, updateMessageResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import {
  deleteOwnLaozuEvents,
  formatSharedEventContext,
  getLaozuMemoryPrivacy,
  loadSharedLaozuEvents,
  queryArchivedLaozuEvents,
  setLaozuMemorySharing
} from "../platform/laozu-shared-events.js";
import { COMPONENT_IDS, laozuMemoryComponents, laozuMemoryDeleteConfirmComponents } from "./components.js";

const PREFIX = `${COMPONENT_IDS.MEMORY_PREFIX}:`;

export function isLaozuMemoryInteraction(customId) {
  return String(customId || "").startsWith(PREFIX);
}

function panel(privacy, notice = "") {
  return {
    content: [
      notice,
      "## ☯ 老祖記憶管理",
      `對外共享：**${privacy.sharePublicEvents ? "開啟" : "關閉"}**`,
      "關閉後，其他玩家與老祖交談時不會取用你的公開事件；你仍可查閱自己的紀錄。"
    ].filter(Boolean).join("\n"),
    components: laozuMemoryComponents(privacy.sharePublicEvents)
  };
}

export async function handleLaozuMemoryInteraction(interaction, env) {
  try {
    const user = getUser(interaction);
    const guildId = interaction.guild_id || "dm";
    const action = String(interaction.data?.custom_id || "").slice(PREFIX.length);
    if (action === "refresh") return updateMessageResponse(panel(await getLaozuMemoryPrivacy(env, { guildId, userId: user.id })));
    if (action === "sharing:on" || action === "sharing:off") {
      const enabled = action.endsWith(":on");
      const privacy = await setLaozuMemorySharing(env, { guildId, userId: user.id, enabled });
      return updateMessageResponse(panel(privacy, enabled ? "✅ 已開啟對外共享。" : "✅ 已關閉對外共享。"));
    }
    if (action === "delete-request") {
      return updateMessageResponse({
        content: "## ⚠️ 確認刪除老祖事件記憶\n這會刪除由你本人敘述的 KV 與長期封存事件，無法復原；不會刪除其他玩家的紀錄。",
        components: laozuMemoryDeleteConfirmComponents()
      });
    }
    if (action === "delete-confirm") {
      const result = await deleteOwnLaozuEvents(env, { guildId, userId: user.id });
      const privacy = await getLaozuMemoryPrivacy(env, { guildId, userId: user.id });
      return updateMessageResponse(panel(privacy, `✅ 已刪除你的事件記憶（KV ${result.deleted} 筆；長期封存${result.archived ? "已同步" : "未設定"}）。`));
    }
    if (action === "view") {
      let events = await loadSharedLaozuEvents(env, { guildId, userIds: [user.id] });
      if (!events.length) events = await queryArchivedLaozuEvents(env, { guildId, requesterId: user.id, userIds: [user.id], limit: 5 });
      const content = events.length
        ? formatSharedEventContext(events, user.id).replace("【伺服器公開頻道的跨玩家事件記憶】", "## 📖 我的老祖事件記憶")
        : "## 📖 我的老祖事件記憶\n目前查無可顯示的事件紀錄。";
      const privacy = await getLaozuMemoryPrivacy(env, { guildId, userId: user.id });
      return updateMessageResponse({ content, components: laozuMemoryComponents(privacy.sharePublicEvents) });
    }
    return componentResponse("❌ 這個記憶管理操作已失效，請重新使用 `/laozu memory`。", [], true);
  } catch (error) {
    return componentResponse(`❌ 記憶管理失敗：${error.message || "未知錯誤"}`, [], true);
  }
}
