import { immediateResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { ensureMaster, getMember } from "../sect/members.js";
import { canManageRanks } from "../sect/permissions.js";
import {
  formatConsistencyReport,
  inspectKvConsistency,
  repairKvConsistency
} from "../sect/consistency.js";
import { runDeferredCommand } from "./deferred.js";

export async function handleSystem(interaction, env, ctx) {
  const subcommand = interaction.data?.options?.[0]?.name;
  if (subcommand === "check") {
    return runDeferredCommand(interaction, ctx, "KV 一致性檢查", async () => {
      const user = getUser(interaction);
      await ensureMaster(env, user);
      const actor = await getMember(env, user.id);
      if (!actor || !canManageRanks(actor.rank)) {
        throw new Error("只有宗主可以執行系統資料檢查。");
      }
      const report = await inspectKvConsistency(env);
      return formatConsistencyReport(report);
    });
  }

  if (subcommand === "repair") {
    const confirm = interaction.data?.options?.[0]?.options
      ?.find(option => option.name === "confirm")?.value;
    if (confirm !== "REPAIR") {
      return immediateResponse("❌ 請先選擇「確認修復索引」。", true);
    }
    return runDeferredCommand(interaction, ctx, "KV 索引修復", async () => {
      const user = getUser(interaction);
      await ensureMaster(env, user);
      const actor = await getMember(env, user.id);
      if (!actor || !canManageRanks(actor.rank)) {
        throw new Error("只有宗主可以執行系統資料檢查。");
      }
      const result = await repairKvConsistency(env, actor.userId);
      return [
        result.changedCount ? "✅ KV 索引修復完成。" : "✅ 檢查完成，沒有需要修復的索引。",
        `修復前：\n${formatConsistencyReport(result.before)}`,
        "本操作只重建索引，沒有刪除任何實體資料。"
      ].join("\n");
    });
  }

  return immediateResponse("❌ 不支援的 /system 子指令。", true);
}
