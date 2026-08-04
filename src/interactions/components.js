export const COMPONENT_IDS = Object.freeze({
  DAILY_GREETING: "sidney:greeting:v1",
  REVIEW_PREFIX: "sidney:application-review:v1",
  UID_REVIEW_PREFIX: "sidney:uid-review:v1",
  ADMIN_PREFIX: "sidney:admin:v1"
});

export function masterAdminPanelComponents() {
  const button = (action, label, emoji, style = 2) => ({ type: 2, style, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:${action}`, label, emoji: { name: emoji } });
  return [
    { type: 1, components: [button("add", "新增領民", "👤", 3), button("bind", "主動綁定 UID", "🔗", 1), button("promote", "晉升長老", "⬆️", 1)] },
    { type: 1, components: [button("demote", "退出百業／降領民", "⬇️"), button("view", "查看玩家", "🔎"), button("remove", "移出名冊", "🚪", 4)] },
    { type: 1, components: [button("audit", "最近操作", "📝"), button("refresh", "重新整理", "🔄")] }
  ];
}

export function adminUserSelect(action) {
  return [{ type: 1, components: [{ type: 5, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:select:${action}`, placeholder: "選擇一位 Discord 玩家", min_values: 1, max_values: 1 }] }];
}

export function adminUidModal(userId) {
  return { customId: `${COMPONENT_IDS.ADMIN_PREFIX}:modal:bind:${userId}`, title: "宗主主動綁定 UID", components: [
    { type: 1, components: [{ type: 4, custom_id: "uid", label: "燕雲十六聲 UID", style: 1, required: true, min_length: 5, max_length: 30, placeholder: "只輸入數字" }] },
    { type: 1, components: [{ type: 4, custom_id: "character_name", label: "遊戲角色名稱", style: 1, required: true, max_length: 50 }] }
  ] };
}

export function adminRemoveConfirmComponents(userId) {
  return [{ type: 1, components: [
    { type: 2, style: 4, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:confirm-remove:${userId}`, label: "確認移出名冊", emoji: { name: "🚪" } },
    { type: 2, style: 2, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:cancel`, label: "取消" }
  ] }];
}

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
