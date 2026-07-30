import {
  APPLICATION_STATUS,
  KV
} from "./constants.js";

import {
  kvGet,
  kvPut,
  appendUnique
} from "./storage.js";

import { nowIso } from "../../utils.js";

export async function getApplication(env, userId) {
  if (!userId) return null;
  return kvGet(
    env,
    KV.APPLICATION(String(userId)),
    null
  );
}

export async function createApplication(
  env,
  applicant
) {
  const userId = String(applicant?.userId || "");
  if (!userId) {
    throw new Error("申請者 Discord ID 不可為空");
  }

  const existing = await getApplication(env, userId);

  if (existing?.status === APPLICATION_STATUS.PENDING) {
    return {
      application: existing,
      created: false
    };
  }

  const application = {
    userId,
    username: applicant.username || "unknown",
    displayName:
      applicant.displayName ||
      applicant.username ||
      "未知仙友",
    reason: String(applicant.reason || "").trim(),
    status: APPLICATION_STATUS.PENDING,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: ""
  };

  await kvPut(
    env,
    KV.APPLICATION(userId),
    application
  );

  await appendUnique(
    env,
    KV.APPLICATION_INDEX,
    userId
  );

  return {
    application,
    created: true
  };
}

export async function listApplications(
  env,
  status = APPLICATION_STATUS.PENDING
) {
  const ids = await kvGet(
    env,
    KV.APPLICATION_INDEX,
    []
  );

  const applications = await Promise.all(
    (Array.isArray(ids) ? ids : [])
      .map(userId => getApplication(env, userId))
  );

  return applications
    .filter(Boolean)
    .filter(item => !status || item.status === status)
    .sort((a, b) =>
      String(a.createdAt)
        .localeCompare(String(b.createdAt))
    );
}

export async function reviewApplication(
  env,
  userId,
  {
    status,
    reviewedBy,
    reviewNote = ""
  }
) {
  const application = await getApplication(env, userId);

  if (!application) {
    throw new Error("找不到該入宗申請");
  }

  if (
    ![
      APPLICATION_STATUS.APPROVED,
      APPLICATION_STATUS.REJECTED
    ].includes(status)
  ) {
    throw new Error("不支援的審核狀態");
  }

  const updated = {
    ...application,
    status,
    updatedAt: nowIso(),
    reviewedAt: nowIso(),
    reviewedBy: String(reviewedBy || ""),
    reviewNote: String(reviewNote || "").trim()
  };

  await kvPut(
    env,
    KV.APPLICATION(String(userId)),
    updated
  );

  return updated;
}

export function formatApplication(application) {
  return [
    `申請者：${application.displayName}`,
    `Discord ID：${application.userId}`,
    `理由：${application.reason || "未填寫"}`,
    `狀態：${application.status}`,
    `申請時間：${application.createdAt}`
  ].join("\n");
}
