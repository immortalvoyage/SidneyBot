import { appendUnique, kvGet, kvPut, removeValue } from "../../sect/storage.js";
import { nowIso } from "../../../utils.js";
import {
  BINDING_STATUS,
  GAME_IDS,
  GAME_KEYS
} from "./constants.js";

function cleanUid(value) {
  const uid = String(value || "").trim();
  if (!/^\d{5,30}$/.test(uid)) {
    throw new Error("UID 格式不正確，請只輸入 5～30 位數字");
  }
  return uid;
}

function cleanName(value) {
  const name = String(value || "").trim().slice(0, 50);
  if (!name) throw new Error("角色名稱不可為空");
  return name;
}

function cleanWeek(value) {
  const week = String(value || "").trim();
  if (!/^\d{4}-W\d{2}$/.test(week)) {
    throw new Error("統計週格式必須為 YYYY-Www，例如 2026-W31");
  }
  return week;
}

function nonNegativeInt(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${fieldName} 必須是 0 以上整數`);
  }
  return number;
}

export async function requestGameBinding(env, {
  gameId = GAME_IDS.WWM,
  userId,
  discordName = "",
  uid,
  characterName
} = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("Discord ID 不可為空");

  const normalizedUid = cleanUid(uid);
  const normalizedName = cleanName(characterName);
  const existing = await kvGet(
    env,
    GAME_KEYS.ACCOUNT_BY_UID(gameId, normalizedUid),
    null
  );

  if (existing?.userId && existing.userId !== normalizedUserId) {
    throw new Error("此 UID 已綁定其他 Discord 帳號，請聯絡宗主處理");
  }

  const request = {
    schemaVersion: 1,
    gameId,
    userId: normalizedUserId,
    discordName: String(discordName || "").slice(0, 100),
    uid: normalizedUid,
    characterName: normalizedName,
    status: BINDING_STATUS.PENDING,
    requestedAt: nowIso(),
    reviewedAt: "",
    reviewedBy: "",
    note: ""
  };

  await kvPut(env, GAME_KEYS.PENDING_BINDING(gameId, normalizedUserId), request);
  await appendUnique(env, GAME_KEYS.PENDING_INDEX(gameId), normalizedUserId);
  return request;
}

export async function getBindingRequest(env, gameId, userId) {
  return kvGet(env, GAME_KEYS.PENDING_BINDING(gameId, String(userId)), null);
}

export async function listPendingBindings(env, gameId = GAME_IDS.WWM) {
  const ids = await kvGet(env, GAME_KEYS.PENDING_INDEX(gameId), []);
  const records = await Promise.all(
    (Array.isArray(ids) ? ids : []).map(userId =>
      getBindingRequest(env, gameId, userId)
    )
  );
  return records.filter(item => item?.status === BINDING_STATUS.PENDING);
}

export async function approveGameBinding(env, {
  gameId = GAME_IDS.WWM,
  userId,
  reviewerId,
  note = ""
} = {}) {
  const request = await getBindingRequest(env, gameId, userId);
  if (!request) throw new Error("找不到此綁定申請");

  const existing = await kvGet(
    env,
    GAME_KEYS.ACCOUNT_BY_UID(gameId, request.uid),
    null
  );
  if (existing?.userId && existing.userId !== String(userId)) {
    throw new Error("此 UID 已綁定其他 Discord 帳號");
  }

  const previousByUser = await kvGet(
    env,
    GAME_KEYS.ACCOUNT_BY_USER(gameId, String(userId)),
    null
  );

  const account = {
    schemaVersion: 1,
    gameId,
    userId: String(userId),
    uid: request.uid,
    currentCharacterName: request.characterName,
    previousCharacterNames: Array.isArray(previousByUser?.previousCharacterNames)
      ? previousByUser.previousCharacterNames
      : [],
    verified: true,
    verifiedAt: nowIso(),
    verifiedBy: String(reviewerId || ""),
    lastSyncedAt: nowIso()
  };

  await Promise.all([
    kvPut(env, GAME_KEYS.ACCOUNT_BY_UID(gameId, request.uid), account),
    kvPut(env, GAME_KEYS.ACCOUNT_BY_USER(gameId, String(userId)), account),
    kvPut(env, GAME_KEYS.PENDING_BINDING(gameId, String(userId)), {
      ...request,
      status: BINDING_STATUS.APPROVED,
      reviewedAt: nowIso(),
      reviewedBy: String(reviewerId || ""),
      note: String(note || "").slice(0, 300)
    }),
    removeValue(env, GAME_KEYS.PENDING_INDEX(gameId), String(userId))
  ]);

  return account;
}

export async function rejectGameBinding(env, {
  gameId = GAME_IDS.WWM,
  userId,
  reviewerId,
  note = ""
} = {}) {
  const request = await getBindingRequest(env, gameId, userId);
  if (!request) throw new Error("找不到此綁定申請");

  const next = {
    ...request,
    status: BINDING_STATUS.REJECTED,
    reviewedAt: nowIso(),
    reviewedBy: String(reviewerId || ""),
    note: String(note || "").slice(0, 300)
  };

  await Promise.all([
    kvPut(env, GAME_KEYS.PENDING_BINDING(gameId, String(userId)), next),
    removeValue(env, GAME_KEYS.PENDING_INDEX(gameId), String(userId))
  ]);
  return next;
}

export async function getGameAccountByUser(env, gameId, userId) {
  return kvGet(env, GAME_KEYS.ACCOUNT_BY_USER(gameId, String(userId)), null);
}

export async function importWeeklyStats(env, {
  gameId = GAME_IDS.WWM,
  week,
  rows = [],
  source = "google_sheets"
} = {}) {
  const normalizedWeek = cleanWeek(week);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("rows 必須包含至少一筆資料");
  }
  if (rows.length > 500) throw new Error("單次最多匯入 500 筆資料");

  const seen = new Set();
  const result = {
    week: normalizedWeek,
    inserted: 0,
    updated: 0,
    renamed: 0,
    unclaimed: 0,
    errors: []
  };

  for (let index = 0; index < rows.length; index += 1) {
    try {
      const row = rows[index] || {};
      const uid = cleanUid(row.uid);
      if (seen.has(uid)) throw new Error("同一批資料中 UID 重複");
      seen.add(uid);

      const characterName = cleanName(row.characterName || row.character_name);
      const offlineDays = nonNegativeInt(row.offlineDays ?? row.offline_days ?? 0, "離線天數");
      const activityScore = nonNegativeInt(row.activityScore ?? row.activity_score ?? 0, "上週活躍度");
      const realmClears = nonNegativeInt(row.realmClears ?? row.realm_clears ?? 0, "上週俠境通關");

      const statKey = GAME_KEYS.WEEKLY_STAT(gameId, normalizedWeek, uid);
      const previousStat = await kvGet(env, statKey, null);
      const account = await kvGet(env, GAME_KEYS.ACCOUNT_BY_UID(gameId, uid), null);

      if (account && account.currentCharacterName !== characterName) {
        const history = new Set(account.previousCharacterNames || []);
        if (account.currentCharacterName) history.add(account.currentCharacterName);
        const updatedAccount = {
          ...account,
          currentCharacterName: characterName,
          previousCharacterNames: [...history].slice(-20),
          lastSyncedAt: nowIso()
        };
        await Promise.all([
          kvPut(env, GAME_KEYS.ACCOUNT_BY_UID(gameId, uid), updatedAccount),
          kvPut(env, GAME_KEYS.ACCOUNT_BY_USER(gameId, account.userId), updatedAccount)
        ]);
        result.renamed += 1;
      }

      const record = {
        schemaVersion: 1,
        gameId,
        week: normalizedWeek,
        uid,
        characterName,
        offlineDays,
        activityScore,
        realmClears,
        note: String(row.note || "").slice(0, 300),
        source,
        importedAt: nowIso(),
        linkedUserId: account?.userId || ""
      };

      await kvPut(env, statKey, record);
      await appendUnique(env, GAME_KEYS.WEEKLY_INDEX(gameId, normalizedWeek), uid);

      if (!account) {
        await appendUnique(env, GAME_KEYS.UNCLAIMED_UIDS(gameId), uid);
        result.unclaimed += 1;
      }

      previousStat ? result.updated += 1 : result.inserted += 1;
    } catch (error) {
      result.errors.push({ row: index + 2, message: error.message });
    }
  }

  return result;
}

export async function getLatestWeeklyStatsForUser(env, {
  gameId = GAME_IDS.WWM,
  userId,
  week
} = {}) {
  const account = await getGameAccountByUser(env, gameId, userId);
  if (!account) return { account: null, stats: null };
  if (!week) return { account, stats: null };

  const stats = await kvGet(
    env,
    GAME_KEYS.WEEKLY_STAT(gameId, cleanWeek(week), account.uid),
    null
  );
  return { account, stats };
}
