/**
 * ☯【仙遊者】☯
 * 動態 Prompt 組合器
 */

import { LAOZU_BASE_PROMPT } from "./laozu.js";
import { normalizePlayerState, relationshipTier } from "../platform/player-state.js";

/**
 * 清理將要放進 Prompt 的文字。
 *
 * 防止 null、undefined 或過長資料直接進入 Prompt。
 */
function normalizeText(value, maxLength = 4000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

/**
 * 建立目前說話者的宗門資訊。
 */
function buildMemberContext(member) {
  if (!member) {
    return `
【目前說話者】

此人的宗門身份尚未確認。
不得自行將其視為正式成員。
`;
  }

  const nickname =
    normalizeText(member.nickname, 50) ||
    normalizeText(member.displayName, 100) ||
    "仙友";

  const displayName =
    normalizeText(member.displayName, 100) ||
    "未記名仙友";

  const rank = normalizeText(member.rank, 30) || "resident";

  const rankNames = {
    master: "宗主",
    elder: "長老",
    disciple: "門徒",
    resident: "領民",
    pending: "待審核者",
    outsider: "陌生人"
  };

  return `
【目前說話者】

Discord 名稱：${displayName}
老祖稱呼：${nickname}
宗門身份：${rankNames[rank] || rank}
是否仍在宗門：${member.active === false ? "否" : "是"}

請依照此人的真實宗門身份回應。
不得自行提升、降低或更改其身份。
`;
}

/**
 * 建立玩家私人記憶。
 */
function buildProfileContext(profile) {
  if (!profile) {
    return `
【仙友私人記憶】

目前沒有可用的私人記憶。
不要假裝記得尚未提供的事情。
`;
  }

  const preferredNickname =
    normalizeText(profile.preferredNickname, 50);

  const mainWeapon =
    normalizeText(profile.mainWeapon, 100);

  const goals = Array.isArray(profile.goals)
    ? profile.goals
        .map((goal) => normalizeText(String(goal), 200))
        .filter(Boolean)
        .slice(0, 10)
    : [];

  const answerStyle = normalizeText(
    profile?.preferences?.answerStyle,
    100
  );

  return `
【仙友私人記憶】

偏好稱呼：${preferredNickname || "未設定"}
常用武器：${mainWeapon || "未設定"}
目前目標：${goals.length > 0 ? goals.join("、") : "未設定"}
偏好回答方式：${answerStyle || "未設定"}

只可將這些資料用於協助目前這名仙友。
不得把私人記憶當作宗門公開資料。
`;
}

function buildPlayerStateContext(playerState) {
  if (!playerState) {
    return `
【萬象錄關係摘要】

目前沒有可用的萬象錄資料。
不得自行猜測好感、信任、請安紀錄或關係階段。
`;
  }

  const state = normalizePlayerState(playerState);
  const tierNames = {
    cherished: "珍視",
    warm: "親近",
    normal: "平常",
    cold: "冷淡",
    refuse_optional: "拒絕非必要互動"
  };
  const tier = relationshipTier(state.relationship);

  return `
【萬象錄關係摘要】

好感：${state.relationship.favor}
信任：${state.relationship.trust}
記仇：${state.relationship.grudge}
互動階段：${tierNames[tier] || tier}
目前連續請安：${state.greeting.currentStreak} 天
累計請安：${state.greeting.totalDays} 天
上次請安：${state.greeting.lastDate || "尚未請安"}

這些數值只用於調整語氣與互動意願。
不得自行更改分數、捏造原因，亦不得讓好感凌駕權限、事實或宗門規則。
`;
}

/**
 * 建立最近對話摘要。
 */
function buildHistoryContext(historySummary) {
  const summary = normalizeText(historySummary, 5000);

  if (!summary) {
    return `
【最近對話】

目前沒有可用的對話摘要。
`;
  }

  return `
【最近對話摘要】

${summary}

摘要只用於維持對話連貫。
若摘要與仙友目前說法衝突，應以目前訊息為準。
`;
}

/**
 * 建立宗門公開資訊。
 */
function buildSectContext(sectContext) {
  const context = normalizeText(sectContext, 5000);

  if (!context) {
    return `
【宗門公開資料】

本次問題不需要載入完整宗門名冊。
不得自行捏造其他宗門成員。
`;
  }

  return `
【宗門公開資料】

${context}

只能使用以上已提供的宗門公開資料。
不得捏造未列出的成員、職位或入宗紀錄。
Discord mention（例如 <@123>）只能依其數字 ID 與名冊逐字比對，不能靠名稱、對話語氣或印象猜測。
若 ID 未列於名冊，只能說「目前正式名冊查無此人」；不得編造對方離宗、遊歷、閉關、乾脆、改名或被遺忘等原因。
若先前答錯，應直接承認並以本次名冊資料更正，不得用角色故事圓場。
`;
}

/**
 * 組合完整的老祖系統 Prompt。
 */
export function buildLaozuSystemPrompt({
  member = null,
  profile = null,
  playerState = null,
  historySummary = "",
  sectContext = ""
} = {}) {
  return [
    LAOZU_BASE_PROMPT,
    buildMemberContext(member),
    buildProfileContext(profile),
    buildPlayerStateContext(playerState),
    buildHistoryContext(historySummary),
    buildSectContext(sectContext)
  ].join("\n\n");
}

export default buildLaozuSystemPrompt;
