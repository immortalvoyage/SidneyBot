/**
 * 萬象錄：玩家與老祖關係資料模型 V1。
 * 此版本只提供安全的預設值與正規化函式，不改動現有 KV Key。
 */

const clamp = (value, min, max) =>
  Math.max(min, Math.min(max, Number(value) || 0));

export function createDefaultPlayerState({
  userId,
  guildId = "global",
  displayName = "",
  daoName = ""
} = {}) {
  const now = new Date().toISOString();

  return {
    schemaVersion: 1,
    userId: String(userId || ""),
    guildId: String(guildId || "global"),
    identity: {
      displayName: String(displayName || ""),
      daoName: String(daoName || ""),
      birthdayMonthDay: "",
      birthdayPublic: false,
      primaryGameId: "wwm"
    },
    relationship: {
      favor: 50,
      trust: 50,
      grudge: 0,
      patienceToday: 100,
      interactionTier: "normal",
      lastReason: ""
    },
    greeting: {
      currentStreak: 0,
      longestStreak: 0,
      totalDays: 0,
      lastDate: ""
    },
    milestones: [],
    createdAt: now,
    updatedAt: now
  };
}

export function normalizePlayerState(input = {}) {
  const base = createDefaultPlayerState({
    userId: input.userId,
    guildId: input.guildId,
    displayName: input?.identity?.displayName,
    daoName: input?.identity?.daoName
  });

  const relationship = input.relationship || {};
  const greeting = input.greeting || {};

  return {
    ...base,
    ...input,
    identity: {
      ...base.identity,
      ...(input.identity || {})
    },
    relationship: {
      ...base.relationship,
      ...relationship,
      favor: clamp(relationship.favor ?? 50, -100, 100),
      trust: clamp(relationship.trust ?? 50, 0, 100),
      grudge: clamp(relationship.grudge ?? 0, 0, 100),
      patienceToday: clamp(
        relationship.patienceToday ?? 100,
        0,
        100
      )
    },
    greeting: {
      ...base.greeting,
      ...greeting,
      currentStreak: Math.max(0, Number(greeting.currentStreak) || 0),
      longestStreak: Math.max(0, Number(greeting.longestStreak) || 0),
      totalDays: Math.max(0, Number(greeting.totalDays) || 0)
    },
    milestones: Array.isArray(input.milestones)
      ? input.milestones.slice(-100)
      : [],
    updatedAt: new Date().toISOString()
  };
}

export function relationshipTier(relationship = {}) {
  const favor = Number(relationship.favor ?? 50);
  const grudge = Number(relationship.grudge ?? 0);

  if (grudge >= 70 || favor <= -50) return "refuse_optional";
  if (grudge >= 45 || favor <= -20) return "cold";
  if (favor >= 80 && grudge <= 10) return "cherished";
  if (favor >= 60) return "warm";
  return "normal";
}
