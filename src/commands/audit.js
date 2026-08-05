import { immediateResponse } from "../../discord.js";
import { getUser } from "../../utils.js";
import { getAudit, listAudits } from "../sect/audit.js";
import { getMember } from "../sect/members.js";
import { canManageRanks } from "../sect/permissions.js";
import { resolveActor } from "../sect/service.js";

const ACTION_LABELS = Object.freeze({
  "application.created": "提交入宗申請",
  "application.approved": "核准入宗申請",
  "application.rejected": "拒絕入宗申請",
  "member.rank_changed": "調整成員身分",
  "member.removed": "移除成員",
  "member.display_name_changed": "修改顯示名稱",
  "memory.cleared": "清除 AI 記憶",
  "laozu.player_reprimanded": "老祖訓誡成員",
  "system.kv_indexes_repaired": "修復 KV 索引"
});

function subcommand(interaction) {
  return interaction?.data?.options?.[0] || null;
}

function subOption(interaction, name) {
  return subcommand(interaction)?.options?.find(item => item.name === name)?.value;
}

function actionLabel(action) {
  return ACTION_LABELS[action] || String(action || "未知操作");
}

function safeText(value, fallback = "無") {
  const text = String(value ?? "").trim();
  return text ? text.replace(/[`*_~|>]/g, "\\$&").slice(0, 500) : fallback;
}

function formatDetails(details) {
  if (!details || typeof details !== "object") return "無";

  const lines = [];
  const labels = {
    previousDisplayName: "原名稱",
    newDisplayName: "新名稱",
    previousRank: "原身分",
    newRank: "新身分",
    displayName: "成員名稱",
    note: "備註",
    reason: "理由",
    previousFavor: "原好感",
    newFavor: "新好感",
    favorDelta: "好感變動",
    gameBindingPreserved: "保留遊戲綁定",
    changedIndexes: "修復索引",
    restoredEntries: "補回索引數",
    removedEntries: "移除失效／重複索引數"
  };

  for (const [key, label] of Object.entries(labels)) {
    if (!(key in details)) continue;
    const value = Array.isArray(details[key])
      ? details[key].join("、")
      : typeof details[key] === "boolean"
      ? (details[key] ? "是" : "否")
      : details[key];
    lines.push(`${label}：${safeText(value)}`);
  }

  if (details.discordRoleSync?.status) {
    lines.push(`Discord 身分組同步：${safeText(details.discordRoleSync.status)}`);
  }

  return lines.length ? lines.join("\n") : "無可顯示內容";
}

async function nameFor(env, userId, fallback = "無") {
  if (!userId) return fallback;
  const member = await getMember(env, userId);
  return member?.displayName || member?.username || fallback;
}

export async function handleAudit(interaction, env) {
  const action = subcommand(interaction)?.name;
  if (!["recent", "view"].includes(action)) {
    return immediateResponse("❌ 不支援的 /audit 子指令。", true);
  }

  try {
    const actor = await resolveActor(env, getUser(interaction));
    if (!actor || !canManageRanks(actor.rank)) {
      throw new Error("只有宗主可以查看 Audit Log");
    }

    if (action === "recent") {
      const records = await listAudits(env, 10);
      if (!records.length) {
        return immediateResponse("## Audit Log\n目前沒有可顯示的操作紀錄。", true);
      }

      const lines = await Promise.all(records.map(async record => {
        const actorName = await nameFor(env, record.actorId, "已離開成員");
        const targetName = record.targetId
          ? await nameFor(env, record.targetId, record.details?.displayName || "已離開成員")
          : "無";
        return [
          `**${actionLabel(record.action)}** · ${safeText(record.createdAt, "時間未知")}`,
          `執行者：${safeText(actorName)}（${safeText(record.actorId)}）`,
          `對象：${safeText(targetName)}（${safeText(record.targetId)}）`,
          `紀錄 ID：\`${String(record.id || "unknown")}\``
        ].join("\n");
      }));

      return immediateResponse(["## 最近 10 筆 Audit Log", ...lines].join("\n\n"), true);
    }

    const record = await getAudit(env, subOption(interaction, "record"));
    if (!record) throw new Error("找不到該 Audit 紀錄，可能已過期或索引已失效");

    const [actorName, targetName] = await Promise.all([
      nameFor(env, record.actorId, "已離開成員"),
      record.targetId
        ? nameFor(env, record.targetId, record.details?.displayName || "已離開成員")
        : Promise.resolve("無")
    ]);

    return immediateResponse([
      "## Audit Log 詳情",
      `操作：${actionLabel(record.action)}`,
      `時間：${safeText(record.createdAt, "未知")}`,
      `執行者：${safeText(actorName)}（${safeText(record.actorId)}）`,
      `對象：${safeText(targetName)}（${safeText(record.targetId)}）`,
      `紀錄 ID：\`${String(record.id || "unknown")}\``,
      "",
      "### 操作內容",
      formatDetails(record.details)
    ].join("\n"), true);
  } catch (error) {
    return immediateResponse(`❌ ${error.message}`, true);
  }
}

export { actionLabel, formatDetails };
