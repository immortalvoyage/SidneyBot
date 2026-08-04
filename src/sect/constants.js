export const RANK = Object.freeze({
  OUTSIDER: "outsider",
  PENDING: "pending",
  RESIDENT: "resident",
  DISCIPLE: "disciple",
  ELDER: "elder",
  MASTER: "master"
});

export const APPLICATION_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected"
});

export const KV = Object.freeze({
  MEMBER_INDEX: "sect:member-index",
  MEMBER: userId => `sect:member:${userId}`,
  APPLICATION_INDEX: "sect:application-index",
  APPLICATION: userId => `sect:application:${userId}`,
  CONFIG: "sect:config",
  AUDIT_INDEX: "sect:audit-index",
  AUDIT: id => `sect:audit:${id}`
});

export const RANK_LABEL = Object.freeze({
  [RANK.OUTSIDER]: "外人",
  [RANK.PENDING]: "待審核",
  [RANK.RESIDENT]: "領民",
  [RANK.DISCIPLE]: "門徒",
  [RANK.ELDER]: "長老",
  [RANK.MASTER]: "宗主"
});
