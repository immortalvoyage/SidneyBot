/**
 * ☯【仙遊者】☯
 * 宗門名冊資料模組
 */

import { KV, RANK } from "./constants.js";
import { isSectMaster } from "./permissions.js";

/**
 * 安全解析 JSON。
 * KV 資料損壞時不讓整個 Bot 崩潰。
 */
function safeParseJson(text, fallback = null) {
  if (!text) {
    return fallback;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("宗門資料 JSON 解析失敗：", error);
    return fallback;
  }
}

/**
 * 建立標準宗門成員資料。
 */
function createMemberRecord({
  userId,
  displayName,
  nickname = "",
  rank = RANK.DISCIPLE,
  approvedBy = null
}) {
  const now = new Date().toISOString();

  return {
    userId,
    displayName,
    nickname,
    rank,
    active: true,

    approvedBy,
    joinedAt: now,
    updatedAt: now,

    publicProfile: {
      mainWeapon: "",
      mainBuild: "",
      playStyle: "",
      introduction: ""
    }
  };
}

/**
 * 取得指定宗門成員。
 */
export async function getMember(env, userId) {
  if (!env?.BOT_MEMORY) {
    throw new Error("缺少 BOT_MEMORY KV 綁定");
  }

  if (!userId) {
    return null;
  }

  const text = await env.BOT_MEMORY.get(
    KV.MEMBER(userId)
  );

  return safeParseJson(text, null);
}

/**
 * 取得宗門成員 ID 索引。
 */
export async function getMemberIndex(env) {
  if (!env?.BOT_MEMORY) {
    throw new Error("缺少 BOT_MEMORY KV 綁定");
  }

  const text = await env.BOT_MEMORY.get(
    KV.MEMBER_INDEX
  );

  const index = safeParseJson(text, []);

  return Array.isArray(index) ? index : [];
}

/**
 * 儲存宗門成員。
 *
 * 同時自動維護 member-index。
 */
export async function saveMember(env, member) {
  if (!env?.BOT_MEMORY) {
    throw new Error("缺少 BOT_MEMORY KV 綁定");
  }

  if (!member?.userId) {
    throw new Error("宗門成員資料缺少 userId");
  }

  const normalizedMember = {
    ...member,
    updatedAt: new Date().toISOString()
  };

  await env.BOT_MEMORY.put(
    KV.MEMBER(member.userId),
    JSON.stringify(normalizedMember)
  );

  const memberIndex = await getMemberIndex(env);

  if (!memberIndex.includes(member.userId)) {
    memberIndex.push(member.userId);

    await env.BOT_MEMORY.put(
      KV.MEMBER_INDEX,
      JSON.stringify(memberIndex)
    );
  }

  return normalizedMember;
}

/**
 * 確保宗主存在於宗門名冊。
 *
 * 只有 Discord User ID 與 SECT_MASTER_ID 相同時，
 * 才會建立或修正為宗主身份。
 */
export async function ensureSectMaster(
  env,
  userId,
  displayName = "凜冬皓月"
) {
  if (!isSectMaster(userId, env)) {
    return null;
  }

  const existingMember = await getMember(env, userId);

  if (existingMember) {
    const updatedMember = {
      ...existingMember,
      displayName:
        displayName ||
        existingMember.displayName ||
        "凜冬皓月",

      nickname: "宗主",
      rank: RANK.MASTER,
      active: true
    };

    return saveMember(env, updatedMember);
  }

  const master = createMemberRecord({
    userId,
    displayName: displayName || "凜冬皓月",
    nickname: "宗主",
    rank: RANK.MASTER,
    approvedBy: userId
  });

  return saveMember(env, master);
}

/**
 * 新增正式弟子。
 *
 * 後續會由 /accept 或 /invite 呼叫。
 */
export async function addDisciple(
  env,
  {
    userId,
    displayName,
    nickname = "",
    approvedBy
  }
) {
  if (!userId) {
    throw new Error("新增弟子時缺少 userId");
  }

  if (!displayName) {
    throw new Error("新增弟子時缺少 displayName");
  }

  const existingMember = await getMember(env, userId);

  const disciple = existingMember
    ? {
        ...existingMember,
        displayName,
        nickname:
          nickname || existingMember.nickname || "",
        rank: RANK.DISCIPLE,
        active: true,
        approvedBy:
          approvedBy ||
          existingMember.approvedBy ||
          null
      }
    : createMemberRecord({
        userId,
        displayName,
        nickname,
        rank: RANK.DISCIPLE,
        approvedBy
      });

  return saveMember(env, disciple);
}

/**
 * 取得所有宗門成員。
 *
 * 預設只回傳仍在宗門中的成員。
 */
export async function getAllMembers(
  env,
  { activeOnly = true } = {}
) {
  const memberIndex = await getMemberIndex(env);

  if (memberIndex.length === 0) {
    return [];
  }

  const members = await Promise.all(
    memberIndex.map((userId) =>
      getMember(env, userId)
    )
  );

  return members.filter((member) => {
    if (!member) {
      return false;
    }

    if (activeOnly) {
      return member.active === true;
    }

    return true;
  });
}

/**
 * 將成員標記為離宗。
 *
 * 目前先保留資料，不直接永久刪除。
 */
export async function deactivateMember(
  env,
  userId,
  removedBy = null,
  reason = ""
) {
  const member = await getMember(env, userId);

  if (!member) {
    return null;
  }

  const updatedMember = {
    ...member,
    active: false,
    removedBy,
    removedReason: reason,
    removedAt: new Date().toISOString()
  };

  return saveMember(env, updatedMember);
}