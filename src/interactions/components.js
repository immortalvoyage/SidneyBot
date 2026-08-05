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

export function adminCandidateSelect(action, candidates, page = 0) {
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(candidates.length / pageSize));
  const safePage = Math.min(Math.max(Number(page) || 0, 0), pageCount - 1);
  const options = candidates.slice(safePage * pageSize, (safePage + 1) * pageSize).map(member => ({
    label: String(member.displayName || member.username || member.userId).slice(0, 100),
    description: String(`@${member.username || "unknown"}`).slice(0, 100),
    value: String(member.userId)
  }));
  const rows = [{ type: 1, components: [{
    type: 3,
    custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:select-candidate:${action}:${safePage}`,
    placeholder: options.length ? candidatePlaceholder(action) : "目前沒有符合資格的玩家",
    min_values: 1,
    max_values: 1,
    options: options.length ? options : [{ label: "沒有符合資格的玩家", value: "none", description: "請確認玩家目前身分與 UID 狀態" }],
    disabled: !options.length
  }] }];
  if (pageCount > 1) rows.push({ type: 1, components: [
    { type: 2, style: 2, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:candidate-page:${action}:${safePage - 1}`, label: "上一頁", disabled: safePage === 0 },
    { type: 2, style: 2, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:candidate-page:${action}:${safePage + 1}`, label: "下一頁", disabled: safePage >= pageCount - 1 }
  ] });
  return rows;
}

function candidatePlaceholder(action) {
  return ({
    add: "只顯示尚未加入仙遊者的成員",
    bind: "只顯示未綁定 UID 的領民",
    promote: "只顯示可晉升的門徒",
    demote: "只顯示門徒與長老",
    view: "選擇名冊內成員",
    remove: "選擇可移出名冊的成員"
  })[action] || "選擇符合資格的玩家";
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
