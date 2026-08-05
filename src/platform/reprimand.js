import { getMember } from "../sect/members.js";
import { isSectMaster } from "../sect/permissions.js";
import { RANK } from "../sect/constants.js";
import { writeAudit } from "../sect/audit.js";
import { kvGet, kvPut } from "../sect/storage.js";
import { ensurePlayerState, savePlayerState } from "./player-state-storage.js";

const PROCESSED_PREFIX = "platform:reprimand:";
const FORMAL_RANKS = [RANK.RESIDENT, RANK.DISCIPLE, RANK.ELDER];

function normalizeReason(value) {
  const reason = String(value || "").normalize("NFC").trim();
  if (Array.from(reason).length < 2) throw new Error("訓誡原因至少需要 2 個字");
  if (Array.from(reason).length > 300) throw new Error("訓誡原因不可超過 300 個字");
  return reason;
}

function normalizeDeduction(value) {
  const deduction = Number(value);
  if (!Number.isInteger(deduction) || deduction < 1 || deduction > 5) {
    throw new Error("好感扣除必須是 1 至 5 的整數");
  }
  return deduction;
}

export async function reprimandPlayer(env, {
  interactionId,
  actor,
  targetUserId,
  favorDeduction,
  reason
}) {
  if (!actor || actor.rank !== RANK.MASTER || !isSectMaster(actor.userId, env)) {
    throw new Error("只有宗主可以命令老祖訓誡並調整好感");
  }

  const targetId = String(targetUserId || "").trim();
  if (!targetId) throw new Error("請指定要訓誡的玩家");
  if (isSectMaster(targetId, env)) throw new Error("宗主資料受到保護，不能成為訓誡對象");

  const eventId = String(interactionId || "").trim();
  if (!eventId) throw new Error("缺少 Discord Interaction ID，無法安全執行");
  const processedKey = `${PROCESSED_PREFIX}${eventId}`;
  const processed = await kvGet(env, processedKey, null);
  if (processed) return { ...processed, duplicate: true };

  const target = await getMember(env, targetId);
  if (!target || !FORMAL_RANKS.includes(target.rank)) {
    throw new Error("訓誡對象必須是仙遊者正式成員，且不可為宗主");
  }

  const deduction = normalizeDeduction(favorDeduction);
  const normalizedReason = normalizeReason(reason);
  const state = await ensurePlayerState(env, target);
  const previousFavor = state.relationship.favor;
  const newFavor = Math.max(-100, previousFavor - deduction);
  const updatedState = await savePlayerState(env, {
    ...state,
    relationship: {
      ...state.relationship,
      favor: newFavor,
      lastReason: normalizedReason
    }
  });

  const audit = await writeAudit(env, {
    action: "laozu.player_reprimanded",
    actorId: actor.userId,
    targetId,
    details: {
      displayName: target.displayName || target.username,
      reason: normalizedReason,
      previousFavor,
      newFavor,
      favorDelta: newFavor - previousFavor,
      interactionId: eventId
    }
  });

  const result = {
    duplicate: false,
    target,
    reason: normalizedReason,
    previousFavor,
    newFavor: updatedState.relationship.favor,
    favorDelta: updatedState.relationship.favor - previousFavor,
    auditId: audit.id
  };
  await kvPut(env, processedKey, result, { expirationTtl: 60 * 60 * 24 * 30 });
  return result;
}
