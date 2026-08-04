import { RANK } from "./constants.js";

export function isSectMaster(userId, env) {
  return Boolean(userId) &&
    String(userId) === String(env.SECT_MASTER_ID || "");
}

export function canUseAI(rank) {
  return [
    RANK.RESIDENT,
    RANK.DISCIPLE,
    RANK.ELDER,
    RANK.MASTER
  ].includes(rank);
}

export function canApprove(rank) {
  return [
    RANK.ELDER,
    RANK.MASTER
  ].includes(rank);
}

export function canApplyForMembership(rank) {
  return !rank;
}

export function canRequestUidBinding(rank) {
  return rank === RANK.RESIDENT;
}

export function canViewUidStatus(rank) {
  return [
    RANK.RESIDENT,
    RANK.DISCIPLE,
    RANK.ELDER,
    RANK.MASTER
  ].includes(rank);
}

export function canManageRanks(rank) {
  return rank === RANK.MASTER;
}

export function canViewMembers(rank) {
  return [
    RANK.RESIDENT,
    RANK.DISCIPLE,
    RANK.ELDER,
    RANK.MASTER
  ].includes(rank);
}
