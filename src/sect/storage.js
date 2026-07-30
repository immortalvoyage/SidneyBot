function assertKv(env) {
  if (!env.BOT_MEMORY) {
    throw new Error(
      "缺少 Cloudflare KV binding：BOT_MEMORY"
    );
  }
  return env.BOT_MEMORY;
}

export async function kvGet(env, key, fallback = null) {
  const kv = assertKv(env);
  const value = await kv.get(key, { type: "json" });
  return value ?? fallback;
}

export async function kvPut(env, key, value, options) {
  const kv = assertKv(env);
  await kv.put(key, JSON.stringify(value), options);
}

export async function kvDelete(env, key) {
  const kv = assertKv(env);
  await kv.delete(key);
}

export async function appendUnique(env, key, value) {
  const list = await kvGet(env, key, []);
  const normalized = Array.isArray(list) ? list : [];

  if (!normalized.includes(value)) {
    normalized.push(value);
    await kvPut(env, key, normalized);
  }

  return normalized;
}

export async function removeValue(env, key, value) {
  const list = await kvGet(env, key, []);
  const normalized = Array.isArray(list) ? list : [];
  const next = normalized.filter(item => item !== value);

  if (next.length !== normalized.length) {
    await kvPut(env, key, next);
  }

  return next;
}
