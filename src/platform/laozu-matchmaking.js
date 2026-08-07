import { getPlayerState } from "./player-state-storage.js";

const PROFILE_PREFIX = "laozu:match:v1";
const DRAFT_PREFIX = "laozu:match-draft:v1";

function clean(value, maxLength) {
  return String(value || "").normalize("NFC").trim().slice(0, maxLength);
}

function profileKey(guildId, userId) {
  return `${PROFILE_PREFIX}:${guildId || "dm"}:${userId}`;
}

function draftKey(guildId, userId) {
  return `${DRAFT_PREFIX}:${guildId || "dm"}:${userId}`;
}

export function normalizeSkills(value) {
  const source = Array.isArray(value) ? value.join("、") : clean(value, 500);
  return [...new Set(
    source
      .split(/[\n,，、；;／/|]+/u)
      .map(item => item.trim())
      .filter(item => item.length >= 2)
  )].slice(0, 12);
}

function terms(value) {
  return new Set(
    clean(value, 700)
      .toLocaleLowerCase("zh-Hant")
      .split(/[\s,，、。；;／/|：:！!？?]+/u)
      .map(item => item.trim())
      .filter(item => item.length >= 2)
  );
}

function scoreProfile(profile, need) {
  const wantedText = clean(need, 700).toLocaleLowerCase("zh-Hant");
  const skillList = normalizeSkills(profile.skillList?.length ? profile.skillList : profile.skills);
  const offeredText = `${skillList.join(" ")} ${profile.note || ""}`.toLocaleLowerCase("zh-Hant");
  const wanted = terms(wantedText);
  const offered = terms(offeredText);
  let score = 0;

  for (const skill of skillList) {
    const normalizedSkill = skill.toLocaleLowerCase("zh-Hant");
    if (wantedText.includes(normalizedSkill)) score += 8;
  }
  for (const word of wanted) {
    if (offered.has(word)) score += 3;
    else if ([...offered].some(item => item.includes(word) || word.includes(item))) score += 1;
  }
  if (!score && [...offered].some(item => wantedText.includes(item))) score = 1;
  return score;
}

export function parseMatchProfileDraft(text) {
  const value = clean(text, 1000);
  const thirdPartySearch = /(不知道|想找|找一下|找找|有沒有|有誰|誰的|誰會|誰能|哪位|哪個).{0,30}(專長|擅長|會|可以協助)/u.test(value)
    || /(專長|擅長).{0,30}(的人|仙友|玩家|成員)/u.test(value);
  if (thirdPartySearch) return null;

  const skillMatch = value.match(/(?:我(?:很)?擅長|我的專長(?:是|有)?|我的能力(?:是|有)?|我可以協助|我可協助|我會做|我會|專長(?:是|有)?|能力(?:是|有)?)[：:\s]*([^。；;\n]{2,220})/u);
  if (!skillMatch) return null;

  let skillsText = skillMatch[1]
    .replace(/(?:，|,)?\s*(?:接案時間|方便時間|可協助時間|有空時間|時間)[：:].*$/u, "")
    .trim();
  const skillList = normalizeSkills(skillsText);
  if (!skillList.length) return null;

  const availabilityMatch = value.match(/(?:接案時間|方便時間|可協助時間|有空時間)[：:\s]*([^。；;\n]{1,120})/u);
  const noteMatch = value.match(/(?:備註|說明)[：:\s]*([^。；;\n]{1,220})/u);
  return {
    skillList,
    skills: skillList.join("、"),
    availability: clean(availabilityMatch?.[1] || "請私下協調", 120),
    note: clean(noteMatch?.[1] || "", 300)
  };
}

export function parseMatchProfilePatch(text) {
  const value = clean(text, 1000);
  const skillMatch = value.match(/(?:專長|能力)[：:\s]*(.+?)(?=(?:，|,)?\s*(?:接案時間|方便時間|可協助時間|有空時間|備註|說明)[：:]|$)/u);
  const availabilityMatch = value.match(/(?:接案時間|方便時間|可協助時間|有空時間)[：:\s]*([^。；;\n]{1,120})/u);
  const noteMatch = value.match(/(?:備註|說明)[：:\s]*([^。；;\n]{0,220})/u);
  const skillList = skillMatch ? normalizeSkills(skillMatch[1]) : null;
  return {
    skillList: skillList?.length ? skillList : null,
    availability: availabilityMatch ? clean(availabilityMatch[1], 120) : null,
    note: noteMatch ? clean(noteMatch[1], 300) : null
  };
}

export async function getMatchProfile(env, guildId, userId) {
  if (!env.BOT_MEMORY) return null;
  return env.BOT_MEMORY.get(profileKey(guildId, userId), { type: "json" });
}

export async function getMatchProfileDraft(env, guildId, userId) {
  if (!env.BOT_MEMORY) return null;
  return env.BOT_MEMORY.get(draftKey(guildId, userId), { type: "json" });
}

export async function saveMatchProfileDraft(env, { guildId, member, draft }) {
  if (!env.BOT_MEMORY) throw new Error("媒合資料庫尚未設定");
  if (!member?.userId || member.active === false) throw new Error("只有仙遊者正式成員可以刊登媒合資料");
  const normalized = {
    userId: String(member.userId),
    displayName: clean(member.displayName || member.username, 100) || "未記名仙友",
    skillList: normalizeSkills(draft?.skillList?.length ? draft.skillList : draft?.skills),
    availability: clean(draft?.availability || "請私下協調", 120),
    note: clean(draft?.note, 300),
    createdAt: new Date().toISOString()
  };
  if (!normalized.skillList.length) throw new Error("請至少提供一項專長");
  await env.BOT_MEMORY.put(draftKey(guildId, member.userId), JSON.stringify(normalized), { expirationTtl: 86400 });
  return normalized;
}

export async function discardMatchProfileDraft(env, guildId, userId) {
  if (env?.BOT_MEMORY?.delete) await env.BOT_MEMORY.delete(draftKey(guildId, userId));
}

export async function publishMatchProfile(env, { guildId, member, skills, skillList, availability, note, consent }) {
  if (!env.BOT_MEMORY) throw new Error("媒合資料庫尚未設定");
  if (!member?.userId || member.active === false) throw new Error("只有仙遊者正式成員可以刊登媒合資料");
  if (consent !== "AGREE") throw new Error("必須明確選擇同意公開媒合，老祖才會刊登資料");

  const normalizedSkillList = normalizeSkills(skillList?.length ? skillList : skills);
  if (!normalizedSkillList.length) throw new Error("請至少填寫一項可協助的專長");

  const profile = {
    version: 2,
    userId: String(member.userId),
    displayName: clean(member.displayName || member.username, 100) || "未記名仙友",
    skillList: normalizedSkillList,
    skills: normalizedSkillList.join("、"),
    availability: clean(availability, 120) || "請私下協調",
    note: clean(note, 300),
    consent: true,
    updatedAt: new Date().toISOString()
  };
  await env.BOT_MEMORY.put(profileKey(guildId, member.userId), JSON.stringify(profile));
  await discardMatchProfileDraft(env, guildId, member.userId);
  return profile;
}

export async function updateMatchProfile(env, { guildId, member, skillList, availability, note }) {
  if (!env.BOT_MEMORY) throw new Error("媒合資料庫尚未設定");
  if (!member?.userId || member.active === false) throw new Error("只有仙遊者正式成員可以修改媒合資料");
  const current = await getMatchProfile(env, guildId, member.userId);
  if (!current?.consent) throw new Error("你目前沒有已公開的專長刊登");

  const nextSkills = skillList?.length
    ? normalizeSkills(skillList)
    : normalizeSkills(current.skillList?.length ? current.skillList : current.skills);
  return publishMatchProfile(env, {
    guildId,
    member,
    skillList: nextSkills,
    availability: availability === null || availability === undefined ? current.availability : availability,
    note: note === null || note === undefined ? current.note : note,
    consent: "AGREE"
  });
}

export async function confirmMatchProfileDraft(env, { guildId, member }) {
  const draft = await getMatchProfileDraft(env, guildId, member?.userId);
  if (!draft) return null;
  return publishMatchProfile(env, {
    guildId,
    member,
    skillList: draft.skillList,
    availability: draft.availability,
    note: draft.note,
    consent: "AGREE"
  });
}

export async function withdrawMatchProfile(env, guildId, userId) {
  if (!env.BOT_MEMORY) throw new Error("媒合資料庫尚未設定");
  await env.BOT_MEMORY.delete(profileKey(guildId, userId));
}

export async function listMatchProfiles(env, { guildId, members = [] }) {
  if (!env.BOT_MEMORY) return [];
  const rows = await Promise.all(
    members
      .filter(member => member?.active !== false)
      .map(async member => {
        const [profile, playerState] = await Promise.all([
          getMatchProfile(env, guildId, member.userId),
          getPlayerState(env, member.userId)
        ]);
        if (!profile?.consent) return null;
        const skillList = normalizeSkills(profile.skillList?.length ? profile.skillList : profile.skills);
        return {
          ...profile,
          skillList,
          skills: skillList.join("、"),
          displayName: profile.displayName || member.displayName || member.username || "未記名仙友",
          favor: Number(playerState?.relationship?.favor || 0)
        };
      })
  );
  return rows.filter(Boolean).sort((a, b) => a.displayName.localeCompare(b.displayName, "zh-Hant"));
}

export async function findMatchProfiles(env, { guildId, requesterId, need, members }) {
  if (!env.BOT_MEMORY) throw new Error("媒合資料庫尚未設定");
  const query = clean(need, 300);
  if (query.length < 2) throw new Error("請描述你需要的協助");

  const candidates = await listMatchProfiles(env, { guildId, members });
  return candidates
    .filter(profile => String(profile.userId) !== String(requesterId))
    .map(profile => ({ ...profile, score: scoreProfile(profile, query) }))
    .filter(profile => profile.score > 0)
    .sort((a, b) => b.favor - a.favor || b.score - a.score || a.displayName.localeCompare(b.displayName, "zh-Hant"))
    .slice(0, 3);
}
