/**
 * Sidney Platform 事件規格 V1。
 * 只定義與整理事件，不呼叫 AI。
 */

export const PLATFORM_EVENT_TYPES = Object.freeze({
  MEMBER_JOINED: "member.joined",
  MEMBER_LEFT: "member.left",
  MEMBER_EXPELLED: "member.expelled",
  MEMBER_REINSTATED: "member.reinstated",
  MEMBER_RENAMED: "member.renamed",
  MEMBER_RANK_CHANGED: "member.rank_changed",
  DAILY_GREETING: "player.daily_greeting",
  BIRTHDAY: "player.birthday",
  JOIN_ANNIVERSARY: "player.join_anniversary",
  FAVOR_CHANGED: "laozu.favor_changed",
  TRUST_CHANGED: "laozu.trust_changed",
  GRUDGE_CHANGED: "laozu.grudge_changed",
  REDEEM_CODE_PUBLISHED: "redeem.published",
  SYSTEM_NOTICE: "system.notice"
});

function text(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function createPlatformEvent({
  type,
  guildId = "global",
  actorId = "system",
  targetId = "",
  gameId = "global",
  visibility = "private",
  data = {},
  createdAt = new Date().toISOString()
} = {}) {
  if (!Object.values(PLATFORM_EVENT_TYPES).includes(type)) {
    throw new Error(`Unsupported platform event type: ${type}`);
  }

  return {
    id: crypto.randomUUID(),
    type,
    guildId: text(guildId, 100) || "global",
    actorId: text(actorId, 100) || "system",
    targetId: text(targetId, 100),
    gameId: text(gameId, 100) || "global",
    visibility: ["private", "members", "public"].includes(visibility)
      ? visibility
      : "private",
    data: data && typeof data === "object" ? data : {},
    createdAt: text(createdAt, 50) || new Date().toISOString()
  };
}
