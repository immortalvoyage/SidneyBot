export const GAME_IDS = Object.freeze({
  WWM: "wwm"
});

export const GAME_LABELS = Object.freeze({
  [GAME_IDS.WWM]: "燕雲十六聲"
});

export const BINDING_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected"
});

export const GAME_KEYS = Object.freeze({
  ACCOUNT_BY_UID: (gameId, uid) => `platform:game:${gameId}:uid:${uid}`,
  ACCOUNT_BY_USER: (gameId, userId) => `platform:game:${gameId}:user:${userId}`,
  PENDING_BINDING: (gameId, userId) => `platform:game:${gameId}:binding:${userId}`,
  PENDING_INDEX: (gameId) => `platform:game:${gameId}:binding:index`,
  WEEKLY_STAT: (gameId, week, uid) => `platform:game:${gameId}:weekly:${week}:${uid}`,
  WEEKLY_INDEX: (gameId, week) => `platform:game:${gameId}:weekly:${week}:index`,
  UNCLAIMED_UIDS: (gameId) => `platform:game:${gameId}:unclaimed`
});
