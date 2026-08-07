const PROFILE_PREFIX = "laozu:match:v1";

function clean(value, maxLength) {
  return String(value || "").normalize("NFC").trim().slice(0, maxLength);
}

function profileKey(guildId, userId) {
  return `${PROFILE_PREFIX}:${guildId || "dm"}:${userId}`;
}

function terms(value) {
  return new Set(
    clean(value, 500)
      .toLocaleLowerCase("zh-Hant")
      .split(/[\s,，、。；;／/|]+/u)
      .map(item => item.trim())
      .filter(item => item.length >= 2)
  );
}

function scoreProfile(profile, need) {
  const wanted = terms(need);
  const offered = terms(`${profile.skills} ${profile.note}`);
  let score = 0;
  for (const word of wanted) {
    if (offered.has(word)) score += 3;
    else if ([...offered].some(item => item.includes(word) || word.includes(item))) score += 1;
  }
  return score;
}

export async function publishMatchProfile(env, { guildId, member, skills, availability, note, consent }) {
  if (!env.BOT_MEMORY) throw new Error("媒合資料庫尚未設定");
  if (!member?.userId || member.active === false) throw new Error("只有仙遊者正式成員可以刊登媒合資料");
  if (consent !== "AGREE") throw new Error("必須明確選擇同意公開媒合，老祖才會刊登資料");

  const normalizedSkills = clean(skills, 300);
  if (normalizedSkills.length < 2) throw new Error("請至少填寫一項可協助的專長");

  const profile = {
    version: 1,
    userId: String(member.userId),
    displayName: clean(member.displayName || member.username, 100) || "未記名仙友",
    skills: normalizedSkills,
    availability: clean(availability, 120) || "請私下協調",
    note: clean(note, 300),
    consent: true,
    updatedAt: new Date().toISOString()
  };
  await env.BOT_MEMORY.put(profileKey(guildId, member.userId), JSON.stringify(profile));
  return profile;
}

export async function withdrawMatchProfile(env, guildId, userId) {
  if (!env.BOT_MEMORY) throw new Error("媒合資料庫尚未設定");
  await env.BOT_MEMORY.delete(profileKey(guildId, userId));
}

export async function findMatchProfiles(env, { guildId, requesterId, need, members }) {
  if (!env.BOT_MEMORY) throw new Error("媒合資料庫尚未設定");
  const query = clean(need, 300);
  if (query.length < 2) throw new Error("請描述你需要的協助");

  const candidates = await Promise.all(
    members
      .filter(member => member?.active !== false && String(member?.userId) !== String(requesterId))
      .map(member => env.BOT_MEMORY.get(profileKey(guildId, member.userId), { type: "json" }))
  );

  return candidates
    .filter(profile => profile?.consent === true)
    .map(profile => ({ ...profile, score: scoreProfile(profile, query) }))
    .filter(profile => profile.score > 0)
    .sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName, "zh-Hant"))
    .slice(0, 5);
}
