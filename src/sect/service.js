import {
  APPLICATION_STATUS,
  RANK
} from "./constants.js";

import {
  getMember,
  removeMember,
  upsertMember,
  ensureMaster
} from "./members.js";

import {
  getApplication,
  reviewApplication
} from "./applications.js";

import { writeAudit } from "./audit.js";
import {
  canApprove,
  canManageRanks,
  isSectMaster
} from "./permissions.js";

export async function resolveActor(
  env,
  user
) {
  await ensureMaster(env, user);
  return getMember(env, user.id);
}

export function normalizeMemberDisplayName(value) {
  const name = String(value || "")
    .normalize("NFC")
    .trim()
    .replace(/[ \t]+/g, " ");

  if (!name) {
    throw new Error("顯示名稱不可為空白");
  }

  if (Array.from(name).length > 32) {
    throw new Error("顯示名稱不可超過 32 個字");
  }

  if (/\p{C}/u.test(name)) {
    throw new Error("顯示名稱不可包含控制字元");
  }

  if (/@everyone|@here|<[@#][!&]?\d+>/i.test(name)) {
    throw new Error("顯示名稱不可包含 Discord 提及標記");
  }

  return name;
}

export async function setOwnDisplayName(env, actor, value) {
  if (!actor?.userId) {
    throw new Error("只有仙遊者正式成員可以修改顯示名稱");
  }

  const current = await getMember(env, actor.userId);
  if (!current || ![RANK.DISCIPLE, RANK.ELDER, RANK.MASTER].includes(current.rank)) {
    throw new Error("只有仙遊者正式成員可以修改顯示名稱");
  }

  const displayName = normalizeMemberDisplayName(value);
  if (current.displayName === displayName) {
    throw new Error("新的顯示名稱與目前名稱相同");
  }

  const previousDisplayName = current.displayName || current.username || "未知仙友";
  const updated = await upsertMember(env, {
    ...current,
    displayName
  });

  await writeAudit(env, {
    action: "member.display_name_changed",
    actorId: current.userId,
    targetId: current.userId,
    details: {
      previousDisplayName,
      newDisplayName: displayName
    }
  });

  return updated;
}

export async function approveApplicant(
  env,
  actor,
  targetUserId,
  note = "",
  syncRoles = null
) {
  if (!actor || !canApprove(actor.rank)) {
    throw new Error("你沒有審核入宗申請的權限");
  }

  const application =
    await getApplication(env, targetUserId);

  if (!application) {
    throw new Error("找不到該入宗申請");
  }

  if (application.status !== APPLICATION_STATUS.PENDING) {
    throw new Error("該申請已經完成審核");
  }

  const discordRoleSync = syncRoles
    ? await syncRoles(application.userId, RANK.DISCIPLE)
    : { status: "not_requested" };

  const member = await upsertMember(env, {
    userId: application.userId,
    username: application.username,
    displayName: application.displayName,
    rank: RANK.DISCIPLE,
    approvedBy: actor.userId
  });

  await reviewApplication(
    env,
    targetUserId,
    {
      status: APPLICATION_STATUS.APPROVED,
      reviewedBy: actor.userId,
      reviewNote: note
    }
  );

  await writeAudit(env, {
    action: "application.approved",
    actorId: actor.userId,
    targetId: targetUserId,
    details: { note, discordRoleSync }
  });

  return { ...member, discordRoleSync };
}

export async function rejectApplicant(
  env,
  actor,
  targetUserId,
  note = ""
) {
  if (!actor || !canApprove(actor.rank)) {
    throw new Error("你沒有審核入宗申請的權限");
  }

  const application =
    await getApplication(env, targetUserId);

  if (!application) {
    throw new Error("找不到該入宗申請");
  }

  if (application.status !== APPLICATION_STATUS.PENDING) {
    throw new Error("該申請已經完成審核");
  }

  const reviewed = await reviewApplication(
    env,
    targetUserId,
    {
      status: APPLICATION_STATUS.REJECTED,
      reviewedBy: actor.userId,
      reviewNote: note
    }
  );

  await writeAudit(env, {
    action: "application.rejected",
    actorId: actor.userId,
    targetId: targetUserId,
    details: { note }
  });

  return reviewed;
}

export async function setMemberRank(
  env,
  actor,
  targetUserId,
  rank,
  note = "",
  syncRoles = null
) {
  if (!actor || !canManageRanks(actor.rank)) {
    throw new Error("只有宗主可以調整成員身分");
  }

  const normalizedTargetId = String(targetUserId || "").trim();
  if (!normalizedTargetId) {
    throw new Error("請選擇要調整的成員");
  }

  if (![RANK.DISCIPLE, RANK.ELDER].includes(rank)) {
    throw new Error("身分只能設定為弟子或長老");
  }

  const target = await getMember(env, normalizedTargetId);
  if (!target) {
    throw new Error("找不到該仙遊者成員");
  }

  if (
    isSectMaster(normalizedTargetId, env) ||
    target.rank === RANK.MASTER
  ) {
    throw new Error("宗主身分受到保護，不能透過此指令修改");
  }

  if (![RANK.DISCIPLE, RANK.ELDER].includes(target.rank)) {
    throw new Error("只能調整正式弟子或長老的身分");
  }

  if (target.rank === rank) {
    throw new Error("該成員目前已是此身分");
  }

  const previousRank = target.rank;
  const discordRoleSync = syncRoles
    ? await syncRoles(normalizedTargetId, rank)
    : { status: "not_requested" };
  const updated = await upsertMember(env, {
    ...target,
    rank
  });

  await writeAudit(env, {
    action: "member.rank_changed",
    actorId: actor.userId,
    targetId: normalizedTargetId,
    details: {
      previousRank,
      newRank: rank,
      note: String(note || "").trim(),
      discordRoleSync
    }
  });

  return { ...updated, discordRoleSync };
}

export async function enrollMemberByMaster(
  env,
  actor,
  targetUser,
  rank = RANK.DISCIPLE,
  note = "",
  syncRoles = null
) {
  if (!actor || !isSectMaster(actor.userId, env) || actor.rank !== RANK.MASTER) {
    throw new Error("只有宗主可以請老祖直接加入新成員");
  }

  const userId = String(targetUser?.id || "").trim();
  if (!userId) throw new Error("請在對話中 @ 提及要加入的玩家");
  if (isSectMaster(userId, env)) throw new Error("宗主已在仙遊者名冊中");
  if (![RANK.DISCIPLE, RANK.ELDER].includes(rank)) {
    throw new Error("新成員身分只能是弟子或長老");
  }

  const existing = await getMember(env, userId);
  if (existing) {
    return { member: existing, created: false, discordRoleSync: null };
  }

  const discordRoleSync = syncRoles
    ? await syncRoles(userId, rank)
    : { status: "not_requested" };
  const username = String(targetUser.username || "unknown").trim() || "unknown";
  const displayName = normalizeMemberDisplayName(
    targetUser.displayName || targetUser.globalName || username
  );
  const member = await upsertMember(env, {
    userId,
    username,
    displayName,
    rank,
    approvedBy: actor.userId
  });

  await writeAudit(env, {
    action: "member.enrolled_by_master_dialogue",
    actorId: actor.userId,
    targetId: userId,
    details: {
      rank,
      note: String(note || "").trim(),
      gameUidBound: false,
      discordRoleSync
    }
  });

  return { member, created: true, discordRoleSync };
}

export async function removeSectMember(
  env,
  actor,
  targetUserId,
  confirmation,
  note = "",
  syncRoles = null
) {
  if (!actor || !canManageRanks(actor.rank)) {
    throw new Error("只有宗主可以移除成員");
  }

  const normalizedTargetId = String(targetUserId || "").trim();
  if (!normalizedTargetId) {
    throw new Error("請選擇要移除的成員");
  }

  if (confirmation !== "REMOVE") {
    throw new Error("請先選擇「確認移除」再執行");
  }

  const target = await getMember(env, normalizedTargetId);
  if (!target) {
    throw new Error("找不到該仙遊者成員");
  }

  if (
    isSectMaster(normalizedTargetId, env) ||
    target.rank === RANK.MASTER
  ) {
    throw new Error("宗主身分受到保護，不能透過此指令移除");
  }

  if (![RANK.DISCIPLE, RANK.ELDER].includes(target.rank)) {
    throw new Error("只能移除正式弟子或長老");
  }

  const discordRoleSync = syncRoles
    ? await syncRoles(normalizedTargetId, null)
    : { status: "not_requested" };

  await removeMember(env, normalizedTargetId);

  await writeAudit(env, {
    action: "member.removed",
    actorId: actor.userId,
    targetId: normalizedTargetId,
    details: {
      displayName: target.displayName,
      previousRank: target.rank,
      gameBindingPreserved: true,
      note: String(note || "").trim(),
      discordRoleSync
    }
  });

  return { ...target, discordRoleSync };
}
