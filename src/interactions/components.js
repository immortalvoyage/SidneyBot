export const COMPONENT_IDS = Object.freeze({
  DAILY_GREETING: "sidney:greeting:v1",
  REVIEW_PREFIX: "sidney:application-review:v1",
  UID_REVIEW_PREFIX: "sidney:uid-review:v1"
});

export function dailyGreetingComponents(disabled = false) {
  return [{
    type: 1,
    components: [{
      type: 2,
      style: 1,
      custom_id: COMPONENT_IDS.DAILY_GREETING,
      label: "向老祖請安",
      emoji: { name: "🙏" },
      disabled
    }]
  }];
}

export function uidReviewComponents(userId, disabled = false) {
  const target = String(userId || "").trim();
  return [{
    type: 1,
    components: [
      {
        type: 2,
        style: 3,
        custom_id: `${COMPONENT_IDS.UID_REVIEW_PREFIX}:approve:${target}`,
        label: "同意 UID 綁定",
        emoji: { name: "✅" },
        disabled
      },
      {
        type: 2,
        style: 4,
        custom_id: `${COMPONENT_IDS.UID_REVIEW_PREFIX}:reject:${target}`,
        label: "拒絕 UID 綁定",
        emoji: { name: "❌" },
        disabled
      }
    ]
  }];
}

export function applicationReviewComponents(userId, disabled = false) {
  const target = String(userId || "").trim();
  return [{
    type: 1,
    components: [
      {
        type: 2,
        style: 3,
        custom_id: `${COMPONENT_IDS.REVIEW_PREFIX}:approve:${target}`,
        label: "同意入宗",
        emoji: { name: "✅" },
        disabled
      },
      {
        type: 2,
        style: 4,
        custom_id: `${COMPONENT_IDS.REVIEW_PREFIX}:reject:${target}`,
        label: "拒絕申請",
        emoji: { name: "❌" },
        disabled
      }
    ]
  }];
}

export function parseApplicationReviewId(customId) {
  const prefix = `${COMPONENT_IDS.REVIEW_PREFIX}:`;
  if (!String(customId || "").startsWith(prefix)) return null;
  const [decision, userId] = String(customId).slice(prefix.length).split(":");
  if (!["approve", "reject"].includes(decision) || !/^\d+$/.test(userId || "")) {
    return null;
  }
  return { decision, userId };
}

export function parseUidReviewId(customId) {
  const prefix = `${COMPONENT_IDS.UID_REVIEW_PREFIX}:`;
  if (!String(customId || "").startsWith(prefix)) return null;
  const [decision, userId] = String(customId).slice(prefix.length).split(":");
  if (!["approve", "reject"].includes(decision) || !/^\d+$/.test(userId || "")) {
    return null;
  }
  return { decision, userId };
}
