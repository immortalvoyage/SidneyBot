import { RANK } from "./constants.js";

export function isSectMaster(userId, env) {
  return userId === env.SECT_MASTER_ID;
}

export function canUseAI(rank) {
  return [
    RANK.DISCIPLE,
    RANK.ELDER,
    RANK.MASTER
  ].includes(rank);
}

export function canApprove(rank) {
  return rank === RANK.MASTER;
}