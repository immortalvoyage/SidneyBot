import {
  KV,
  RANK,
  RANK_LABEL
} from "./constants.js";

import {
  kvGet,
  kvPut,
  appendUnique,
  removeValue
} from "./storage.js";

import { isSectMaster } from "./permissions.js";
import { nowIso } from "../../utils.js";
import { ensurePlayerState } from "../platform/player-state-storage.js";

export async function ensureMaster(env, user = {}) {
  const userId = String(user.id || "");

  if (!isSectMaster(userId, env)) {
    return null;
  }

  const existing = await getMember(env, userId);
  if (existing?.rank === RANK.MASTER) {
    return existing;
  }

  return upsertMember(env, {
    userId,
    username: user.username || "宗主",
    displayName:
      user.global_name ||
      user.username ||
      "宗主",
    rank: RANK.MASTER,
    joinedAt: existing?.joinedAt || nowIso(),
    updatedAt: nowIso(),
    approvedBy: userId
  });
}

export async function getMember(env, userId) {
  if (!userId) return null;
  return kvGet(env, KV.MEMBER(String(userId)), null);
}

export async function upsertMember(env, member) {
  const userId = String(member?.userId || "");
  if (!userId) {
    throw new Error("member.userId 不可為空");
  }

  const current = await getMember(env, userId);

  const next = {
    userId,
    username:
      member.username ||
      current?.username ||
      "unknown",
    displayName:
      member.displayName ||
      current?.displayName ||
      member.username ||
      "未知仙友",
    rank:
      member.rank ||
      current?.rank ||
      RANK.DISCIPLE,
    joinedAt:
      member.joinedAt ||
      current?.joinedAt ||
      nowIso(),
    updatedAt: nowIso(),
    approvedBy:
      member.approvedBy ??
      current?.approvedBy ??
      null
  };

  await kvPut(env, KV.MEMBER(userId), next);
  await appendUnique(env, KV.MEMBER_INDEX, userId);
  await ensurePlayerState(env, next);

  return next;
}

export async function removeMember(env, userId) {
  await Promise.all([
    env.BOT_MEMORY.delete(KV.MEMBER(String(userId))),
    removeValue(env, KV.MEMBER_INDEX, String(userId))
  ]);
}

export async function listMembers(env) {
  const ids = await kvGet(env, KV.MEMBER_INDEX, []);
  const members = await Promise.all(
    (Array.isArray(ids) ? ids : [])
      .map(userId => getMember(env, userId))
  );

  const order = {
    [RANK.MASTER]: 0,
    [RANK.ELDER]: 1,
    [RANK.DISCIPLE]: 2,
    [RANK.PENDING]: 3,
    [RANK.OUTSIDER]: 4
  };

  return members
    .filter(Boolean)
    .sort((a, b) => {
      const rankDiff =
        (order[a.rank] ?? 99) -
        (order[b.rank] ?? 99);

      return rankDiff ||
        String(a.displayName)
          .localeCompare(String(b.displayName), "zh-Hant");
    });
}

export function formatMember(member) {
  if (!member) return "未入宗";

  return [
    `身分：${RANK_LABEL[member.rank] || member.rank}`,
    `名稱：${member.displayName || member.username}`,
    `Discord ID：${member.userId}`,
    `入宗時間：${member.joinedAt || "未知"}`
  ].join("\n");
}
