import {
  createDefaultPlayerState,
  normalizePlayerState
} from "./player-state.js";
import { kvGet, kvPut } from "../sect/storage.js";

const PLAYER_STATE_PREFIX = "platform:player-state:";

export function playerStateKey(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized) throw new Error("playerState userId 不可為空");
  return `${PLAYER_STATE_PREFIX}${normalized}`;
}

export async function getPlayerState(env, userId) {
  if (!String(userId || "").trim()) return null;
  const stored = await kvGet(env, playerStateKey(userId), null);
  return stored ? normalizePlayerState(stored) : null;
}

export async function savePlayerState(env, state) {
  const normalized = normalizePlayerState(state);
  if (!normalized.userId) throw new Error("playerState userId 不可為空");
  await kvPut(env, playerStateKey(normalized.userId), normalized);
  return normalized;
}

export async function ensurePlayerState(env, member) {
  const userId = String(member?.userId || "").trim();
  if (!userId) throw new Error("member.userId 不可為空");

  const key = playerStateKey(userId);
  const stored = await kvGet(env, key, null);
  const displayName = String(
    member.displayName || member.username || "未知仙友"
  ).trim();

  if (stored) {
    const current = normalizePlayerState(stored);
    if (current.identity.displayName === displayName) return current;

    const updated = normalizePlayerState({
      ...current,
      identity: {
        ...current.identity,
        displayName
      }
    });
    await kvPut(env, key, updated);
    return updated;
  }

  const created = createDefaultPlayerState({
    userId,
    displayName
  });
  if (member.joinedAt) created.createdAt = member.joinedAt;
  created.updatedAt = created.createdAt;
  await kvPut(env, key, created);
  return created;
}
