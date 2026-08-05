import { getMember } from "../sect/members.js";
import { ensurePlayerState, savePlayerState } from "./player-state-storage.js";
import { normalizePlayerState } from "./player-state.js";

export function taipeiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function previousDate(dateText) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export async function recordDailyGreeting(env, userId, now = new Date()) {
  const member = await getMember(env, userId);
  if (!member) throw new Error("只有仙遊者正式成員可以向老祖請安");

  const state = await ensurePlayerState(env, member);

  const today = taipeiDate(now);
  if (state.greeting.lastDate === today) {
    return { created: false, state, date: today };
  }

  const continued = state.greeting.lastDate === previousDate(today);
  const currentStreak = continued ? state.greeting.currentStreak + 1 : 1;
  const updated = normalizePlayerState({
    ...state,
    relationship: {
      ...state.relationship,
      favor: Math.min(100, state.relationship.favor + 1),
      lastReason: "每日請安"
    },
    greeting: {
      ...state.greeting,
      currentStreak,
      longestStreak: Math.max(state.greeting.longestStreak, currentStreak),
      totalDays: state.greeting.totalDays + 1,
      lastDate: today
    }
  });
  await savePlayerState(env, updated);
  return { created: true, state: updated, date: today };
}
