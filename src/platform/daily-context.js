/**
 * 老祖每日狀態資料模型。
 * 每天可由一次 AI 呼叫產生，再供 Discord、網站與請安共用。
 */

export function createEmptyDailyContext(date = "") {
  return {
    schemaVersion: 1,
    date: date || new Date().toISOString().slice(0, 10),
    mood: "calm",
    moodScore: 60,
    edict: "",
    greeting: "",
    farewell: "",
    homepageBanner: "",
    specialDay: "",
    weatherSummary: "",
    majorNewsSummary: "",
    gameNewsSummary: "",
    platformMessage: "",
    birthdayUserIds: [],
    milestoneUserIds: [],
    generatedAt: "",
    source: "fallback"
  };
}

export function normalizeDailyContext(input = {}) {
  const base = createEmptyDailyContext(input.date);
  const score = Number(input.moodScore ?? base.moodScore);

  return {
    ...base,
    ...input,
    moodScore: Math.max(0, Math.min(100, score || 0)),
    birthdayUserIds: Array.isArray(input.birthdayUserIds)
      ? input.birthdayUserIds.map(String)
      : [],
    milestoneUserIds: Array.isArray(input.milestoneUserIds)
      ? input.milestoneUserIds.map(String)
      : []
  };
}
