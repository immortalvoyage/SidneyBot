import { kvGet, kvPut } from "../sect/storage.js";
import { syncLaozuDataCenter } from "./laozu-data-center.js";

const STATE_KEY = "platform:laozu:mood-state:v1";
const SIGNAL_PREFIX = "platform:laozu:signal:";
const DAY_SECONDS = 86_400;

const clamp = value => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

export function createDefaultLaozuMoodState(now = new Date()) {
  return {
    schemaVersion: 1,
    joy: 58,
    safety: 62,
    fatigue: 24,
    trust: 55,
    communityPressure: 18,
    interactionCount: 0,
    signalCount: 0,
    lastSignalAt: "",
    updatedAt: now.toISOString()
  };
}

export function normalizeLaozuMoodState(input = {}, now = new Date()) {
  const base = createDefaultLaozuMoodState(now);
  return {
    ...base,
    ...input,
    joy: clamp(input.joy ?? base.joy),
    safety: clamp(input.safety ?? base.safety),
    fatigue: clamp(input.fatigue ?? base.fatigue),
    trust: clamp(input.trust ?? base.trust),
    communityPressure: clamp(input.communityPressure ?? base.communityPressure),
    interactionCount: Math.max(0, Number(input.interactionCount) || 0),
    signalCount: Math.max(0, Number(input.signalCount) || 0),
    updatedAt: String(input.updatedAt || base.updatedAt)
  };
}

function elapsedDays(from, to) {
  const start = Date.parse(from || "");
  return Number.isFinite(start) ? Math.max(0, (to.getTime() - start) / 86_400_000) : 0;
}

export function decayLaozuMoodState(input, now = new Date()) {
  const state = normalizeLaozuMoodState(input, now);
  const days = elapsedDays(state.updatedAt, now);
  if (days < 0.04) return state;
  return normalizeLaozuMoodState({
    ...state,
    joy: state.joy + (55 - state.joy) * Math.min(1, days / 10),
    safety: state.safety + (60 - state.safety) * Math.min(1, days / 14),
    fatigue: state.fatigue + (20 - state.fatigue) * Math.min(1, days / 5),
    trust: state.trust + (50 - state.trust) * Math.min(1, days / 30),
    communityPressure: state.communityPressure + (15 - state.communityPressure) * Math.min(1, days / 7),
    updatedAt: now.toISOString()
  }, now);
}

export function publicLaozuMoodState(input, now = new Date()) {
  const state = decayLaozuMoodState(input, now);
  const score = clamp((state.joy + state.safety + state.trust - state.fatigue - state.communityPressure + 100) / 3);
  const tone = state.communityPressure >= 60 ? "guardian" : state.fatigue >= 68 ? "resting" : score >= 72 ? "playful" : score >= 52 ? "gentle" : "quiet";
  return { ...state, score, tone };
}

const SIGNALS = Object.freeze({
  meaningful_chat: { joy: 2, trust: 1, fatigue: 1, interactionCount: 1 },
  daily_greeting: { joy: 1, safety: 2, interactionCount: 1 },
  member_helped: { joy: 3, safety: 2, trust: 2 },
  activity_joined: { joy: 3, trust: 1, fatigue: 1 },
  conflict_resolved: { safety: 4, trust: 2, communityPressure: -4 },
  player_reprimanded: { joy: -2, fatigue: 3, communityPressure: 5 },
  redeem_codes_found: { joy: 2, safety: 1 }
});

export async function getLaozuMoodState(env, now = new Date()) {
  return decayLaozuMoodState(await kvGet(env, STATE_KEY, null) || createDefaultLaozuMoodState(now), now);
}

export async function recordLaozuSignal(env, { type, actorId = "system", eventId = "", weight = 1, now = new Date() } = {}) {
  const delta = SIGNALS[type];
  if (!delta) throw new Error(`Unsupported Laozu signal: ${type}`);
  const safeActor = String(actorId || "system").replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 100) || "system";
  const day = now.toISOString().slice(0, 10);
  const dedupeId = String(eventId || `${type}:${safeActor}:${day}`).replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 160);
  const dedupeKey = `${SIGNAL_PREFIX}${dedupeId}`;
  if (await kvGet(env, dedupeKey, null)) return { applied: false, state: await getLaozuMoodState(env, now) };

  const factor = Math.max(0.25, Math.min(3, Number(weight) || 1));
  const current = await getLaozuMoodState(env, now);
  const next = normalizeLaozuMoodState({
    ...current,
    joy: current.joy + (delta.joy || 0) * factor,
    safety: current.safety + (delta.safety || 0) * factor,
    fatigue: current.fatigue + (delta.fatigue || 0) * factor,
    trust: current.trust + (delta.trust || 0) * factor,
    communityPressure: current.communityPressure + (delta.communityPressure || 0) * factor,
    interactionCount: current.interactionCount + (delta.interactionCount || 0),
    signalCount: current.signalCount + 1,
    lastSignalAt: now.toISOString(),
    updatedAt: now.toISOString()
  }, now);
  await Promise.all([
    kvPut(env, STATE_KEY, next),
    kvPut(env, dedupeKey, { type, actorId: safeActor, receivedAt: now.toISOString() }, { expirationTtl: DAY_SECONDS * 35 })
  ]);
  try {
    await syncLaozuDataCenter(env, "sync_mood", {
      source: "laozu_mood_state",
      version: "4.3.22",
      mood: publicLaozuMoodState(next, now),
      note: type
    });
  } catch (error) {
    console.error("老祖心情同步 Google Sheets 失敗", error);
  }
  return { applied: true, state: next };
}
