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
