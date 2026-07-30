import {
  APPLICATION_STATUS,
  RANK
} from "./constants.js";

import {
  getMember,
  upsertMember,
  ensureMaster
} from "./members.js";

import {
  getApplication,
  reviewApplication
} from "./applications.js";

import { writeAudit } from "./audit.js";
import { canApprove } from "./permissions.js";

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
    details: { note }
  });

  return member;
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
