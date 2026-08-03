import { KV } from "./constants.js";
import {
  kvGet,
  kvPut,
  appendUnique
} from "./storage.js";
import { nowIso, randomId } from "../../utils.js";

export async function writeAudit(
  env,
  {
    action,
    actorId,
    targetId = null,
    details = {}
  }
) {
  const id = randomId("audit");

  const record = {
    id,
    action: String(action || "unknown"),
    actorId: String(actorId || ""),
    targetId:
      targetId === null
        ? null
        : String(targetId),
    details,
    createdAt: nowIso()
  };

  await kvPut(env, KV.AUDIT(id), record);
  await appendUnique(env, KV.AUDIT_INDEX, id);

  return record;
}

export async function listAudits(env, limit = 20) {
  const ids = await kvGet(env, KV.AUDIT_INDEX, []);
  const selected = (Array.isArray(ids) ? ids : [])
    .slice(-Math.max(1, Math.min(limit, 100)))
    .reverse();

  const rows = await Promise.all(
    selected.map(id =>
      kvGet(env, KV.AUDIT(id), null)
    )
  );

  return rows.filter(Boolean);
}

export async function getAudit(env, auditId) {
  const id = String(auditId || "").trim();
  if (!id) return null;
  return kvGet(env, KV.AUDIT(id), null);
}
