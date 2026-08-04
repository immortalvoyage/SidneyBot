import { sendUserDirectMessage } from "../../discord.js";
import { writeAudit } from "./audit.js";

export const UID_BINDING_GUIDE = [
  "加入後請在仙遊者 Discord 伺服器使用：",
  "`/遊戲 綁定 UID:<你的燕雲十六聲UID> 角色名稱:<遊戲角色名稱>`",
  "送出後等待宗主或長老審核；請勿把 UID 綁定到其他人的 Discord 帳號。"
].join("\n");

export async function notifyMember(env, {
  userId,
  actorId,
  event,
  content
}) {
  let status = "sent";
  let error = "";
  try {
    await sendUserDirectMessage(userId, env.DISCORD_BOT_TOKEN, content);
  } catch (caught) {
    status = "failed";
    error = String(caught?.message || caught).slice(0, 500);
  }

  await writeAudit(env, {
    action: "discord.dm_notification",
    actorId: actorId || "laozu",
    targetId: userId,
    details: { event, status, error }
  });
  return { status, error };
}

export function notificationSummary(result) {
  return result?.status === "sent"
    ? "玩家私人訊息：已發送"
    : "玩家私人訊息：發送失敗（玩家可能關閉私訊；成員操作已完成）";
}
