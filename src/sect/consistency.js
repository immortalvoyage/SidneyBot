import { KV } from "./constants.js";
import { GAME_IDS, GAME_KEYS, BINDING_STATUS } from "../platform/games/constants.js";
import { kvGet, kvPut } from "./storage.js";
import { writeAudit } from "./audit.js";

const CHECKS = Object.freeze([
  {
    name: "成員名冊",
    indexKey: KV.MEMBER_INDEX,
    prefix: "sect:member:",
    include: record => Boolean(record?.userId),
    orderField: "joinedAt"
  },
  {
    name: "入宗申請",
    indexKey: KV.APPLICATION_INDEX,
    prefix: "sect:application:",
    include: record => Boolean(record?.userId),
    orderField: "createdAt"
  },
  {
    name: "Audit Log",
    indexKey: KV.AUDIT_INDEX,
    prefix: "sect:audit:",
    include: record => Boolean(record?.id),
    orderField: "createdAt"
  },
  {
    name: "待審遊戲綁定",
    indexKey: GAME_KEYS.PENDING_INDEX(GAME_IDS.WWM),
    prefix: `platform:game:${GAME_IDS.WWM}:binding:`,
    excludeKeys: new Set([GAME_KEYS.PENDING_INDEX(GAME_IDS.WWM)]),
    include: record => record?.status === BINDING_STATUS.PENDING,
    orderField: "requestedAt"
  }
]);

function assertListApi(env) {
  if (!env?.BOT_MEMORY?.list) {
    throw new Error("目前 KV binding 不支援資料一致性掃描");
  }
}

async function listKeys(env, prefix) {
  assertListApi(env);
  const names = [];
  let cursor;
  do {
    const page = await env.BOT_MEMORY.list({ prefix, cursor });
    for (const item of page?.keys || []) names.push(item.name);
    cursor = page?.list_complete === false ? page.cursor : undefined;
  } while (cursor);
  return names;
}

function normalizeIds(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map(item => String(item || "").trim())
    .filter(Boolean))];
}

async function inspectCheck(env, definition) {
  const rawIndex = await kvGet(env, definition.indexKey, []);
  const indexedIds = normalizeIds(rawIndex);
  const physicalKeys = (await listKeys(env, definition.prefix))
    .filter(key => !definition.excludeKeys?.has(key));
  const records = await Promise.all(physicalKeys.map(async key => ({
    key,
    id: key.slice(definition.prefix.length),
    value: await kvGet(env, key, null)
  })));
  const validIds = records
    .filter(item => item.id && definition.include(item.value))
    .sort((a, b) => String(a.value?.[definition.orderField] || "")
      .localeCompare(String(b.value?.[definition.orderField] || "")))
    .map(item => item.id);
  const validSet = new Set(validIds);
  const indexedSet = new Set(indexedIds);
  const missingFromIndex = validIds.filter(id => !indexedSet.has(id));
  const staleIndexEntries = indexedIds.filter(id => !validSet.has(id));
  const duplicateEntries = Array.isArray(rawIndex)
    ? rawIndex.length - normalizeIds(rawIndex).length
    : 0;

  return {
    name: definition.name,
    indexKey: definition.indexKey,
    indexedCount: indexedIds.length,
    recordCount: validIds.length,
    missingFromIndex,
    staleIndexEntries,
    duplicateEntries,
    repairedIndex: validIds
  };
}

export async function inspectKvConsistency(env) {
  const checks = await Promise.all(
    CHECKS.map(definition => inspectCheck(env, definition))
  );
  return {
    healthy: checks.every(item =>
      item.missingFromIndex.length === 0 &&
      item.staleIndexEntries.length === 0 &&
      item.duplicateEntries === 0
    ),
    checks
  };
}

export async function repairKvConsistency(env, actorId) {
  const before = await inspectKvConsistency(env);
  const changed = before.checks.filter(item =>
    item.missingFromIndex.length ||
    item.staleIndexEntries.length ||
    item.duplicateEntries
  );

  for (const item of changed) {
    await kvPut(env, item.indexKey, item.repairedIndex);
  }

  await writeAudit(env, {
    action: "system.kv_indexes_repaired",
    actorId,
    details: {
      changedIndexes: changed.map(item => item.indexKey),
      restoredEntries: changed.reduce((sum, item) => sum + item.missingFromIndex.length, 0),
      removedEntries: changed.reduce((sum, item) => sum + item.staleIndexEntries.length + item.duplicateEntries, 0)
    }
  });

  return { before, changedCount: changed.length };
}

export function formatConsistencyReport(report) {
  const lines = [report.healthy ? "✅ KV 索引一致性正常。" : "⚠️ 發現 KV 索引不一致："];
  for (const item of report.checks) {
    lines.push(
      `${item.name}：資料 ${item.recordCount}｜索引 ${item.indexedCount}｜漏列 ${item.missingFromIndex.length}｜失效 ${item.staleIndexEntries.length}｜重複 ${item.duplicateEntries}`
    );
  }
  return lines.join("\n");
}
