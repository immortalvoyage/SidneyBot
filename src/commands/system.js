import { immediateResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { ensureMaster, getMember } from "../sect/members.js";
import { canManageRanks } from "../sect/permissions.js";
import {
  formatConsistencyReport,
  inspectKvConsistency,
  repairKvConsistency
} from "../sect/consistency.js";

export async function handleSystem(interaction, env) {
  const user = getUser(interaction);
  await ensureMaster(env, user);
  const actor = await getMember(env, user.id);
  if (!actor || !canManageRanks(actor.rank)) {
    return immediateResponse("❌ 只有宗主可以執行系統資料檢查。", true);
  }

  const subcommand = interaction.data?.options?.[0]?.name;
  if (subcommand === "check") {
    const report = await inspectKvConsistency(env);
    return immediateResponse(formatConsistencyReport(report), true);
  }

  if (subcommand === "repair") {
    const confirm = interaction.data?.options?.[0]?.options
      ?.find(option => option.name === "confirm")?.value;
    if (confirm !== "REPAIR") {
      return immediateResponse("❌ 請先選擇「確認修復索引」。", true);
    }
    const result = await repairKvConsistency(env, actor.userId);
    return immediateResponse([
      result.changedCount ? "✅ KV 索引修復完成。" : "✅ 檢查完成，沒有需要修復的索引。",
      `修復前：\n${formatConsistencyReport(result.before)}`,
      "本操作只重建索引，沒有刪除任何實體資料。"
    ].join("\n"), true);
  }

  return immediateResponse("❌ 不支援的 /system 子指令。", true);
}
