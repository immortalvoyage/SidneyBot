/**
 * ☯【仙遊者】☯
 * 宗門常數
 */

export const RANK = Object.freeze({
  OUTSIDER: "outsider",
  PENDING: "pending",
  DISCIPLE: "disciple",
  ELDER: "elder",
  MASTER: "master"
});

export const KV = Object.freeze({
  MEMBER_INDEX: "sect:member-index",

  MEMBER: (userId) => `sect:member:${userId}`,

  PROFILE: (userId) => `profile:${userId}`,

  HISTORY: (userId) => `history:${userId}`,

  APPLICATION: (userId) =>
    `sect:application:${userId}`,

  CONFIG: "sect:config",

  AUDIT: (id) => `audit:${id}`
});