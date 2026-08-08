export const COMPONENT_IDS = Object.freeze({
  DAILY_GREETING: "sidney:greeting:v1",
  REVIEW_PREFIX: "sidney:application-review:v1",
  UID_REVIEW_PREFIX: "sidney:uid-review:v1",
  MEMORY_PREFIX: "sidney:laozu-memory:v1",
  LISTING_PREFIX: "sidney:laozu-listing:v1",
  ADMIN_PREFIX: "sidney:admin:v1"
});

export function laozuListingConfirmComponents(userId) {
  const ownerId = String(userId || "").trim();
  const prefix = COMPONENT_IDS.LISTING_PREFIX;
  return [{ type: 1, components: [
    { type: 2, style: 3, custom_id: `${prefix}:confirm:${ownerId}`, label: "確認更新", emoji: { name: "✅" } },
    { type: 2, style: 2, custom_id: `${prefix}:cancel:${ownerId}`, label: "取消更新", emoji: { name: "✖️" } }
  ] }];
}

export function masterAdminPanelComponents() {
  const button = (action, label, emoji, style = 2) => ({ type: 2, style, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:${action}`, label, emoji: { name: emoji } });
  return [
    { type: 1, components: [button("add", "新增領民", "👤", 1), button("bind", "綁定 UID", "🔗", 1), button("promote", "晉升長老", "⬆️", 1)] },
    { type: 1, components: [button("view", "查看成員", "🔎"), button("demote", "調整為領民", "⬇️"), button("remove", "移出名冊", "🚪", 4)] },
    { type: 1, components: [button("match-profiles", "專長刊登管理", "📋", 1), button("memory-privacy", "記憶權限", "🔐", 1), button("capabilities", "老祖能力建議", "🧠", 1), button("command-permissions", "指令權限", "⚙️", 1), button("audit", "操作紀錄", "📝")] },
    { type: 1, components: [button("refresh", "重新整理", "🔄")] }
  ];
}

export function laozuMemoryComponents(sharePublicEvents = true) {
  const prefix = COMPONENT_IDS.MEMORY_PREFIX;
  return [
    { type: 1, components: [
      { type: 2, style: 1, custom_id: `${prefix}:view`, label: "查閱我的紀錄", emoji: { name: "📖" } },
      { type: 2, style: sharePublicEvents ? 2 : 3, custom_id: `${prefix}:sharing:${sharePublicEvents ? "off" : "on"}`, label: sharePublicEvents ? "關閉對外共享" : "開啟對外共享", emoji: { name: sharePublicEvents ? "🔒" : "🔓" } }
    ] },
    { type: 1, components: [
      { type: 2, style: 4, custom_id: `${prefix}:delete-request`, label: "刪除我的事件記憶", emoji: { name: "🗑️" } },
      { type: 2, style: 2, custom_id: `${prefix}:refresh`, label: "重新整理", emoji: { name: "🔄" } }
    ] }
  ];
}

export function laozuMemoryDeleteConfirmComponents() {
  const prefix = COMPONENT_IDS.MEMORY_PREFIX;
  return [{ type: 1, components: [
    { type: 2, style: 4, custom_id: `${prefix}:delete-confirm`, label: "確認永久刪除", emoji: { name: "⚠️" } },
    { type: 2, style: 2, custom_id: `${prefix}:refresh`, label: "取消", emoji: { name: "↩️" } }
  ] }];
}

export function capabilitySuggestionComponents(items, selectedIndex = 0) {
  const rows = (items || []).slice(0, 5);
  if (!rows.length) return [{ type: 1, components: [{ type: 2, style: 2, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:refresh`, label: "返回管理中心", emoji: { name: "↩️" } }] }];
  const index = Math.max(0, Math.min(Number(selectedIndex) || 0, rows.length - 1));
  const item = rows[index];
  const version = item.version || "invalid";
  const components = [{
    type: 1,
    components: [
      { type: 2, style: 3, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:capability:developed:${item.id}:${version}`, label: "此筆｜標記已開發", emoji: { name: "✅" } },
      { type: 2, style: 4, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:capability:rejected:${item.id}:${version}`, label: "此筆｜拒絕", emoji: { name: "🚫" } }
    ]
  }];
  if (rows.length > 1) components.push({
    type: 1,
    components: [
      { type: 2, style: 2, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:capability-page:${rows[(index - 1 + rows.length) % rows.length].id}`, label: "上一筆", emoji: { name: "◀️" } },
      { type: 2, style: 2, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:capability-page:${rows[(index + 1) % rows.length].id}`, label: "下一筆", emoji: { name: "▶️" } },
      { type: 2, style: 2, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:refresh`, label: "稍後處理", emoji: { name: "↩️" } }
    ]
  });
  return components;
}

export function matchProfileAdminComponents(profiles) {
  const rows = profiles || [];
  const options = rows.slice(0, 25).map(profile => ({
    label: String(profile.displayName || profile.userId).slice(0, 100),
    description: String(profile.skills || "未填專長").slice(0, 100),
    value: String(profile.userId)
  }));
  return [{
    type: 1,
    components: [{
      type: 3,
      custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:match-profile-select`,
      placeholder: options.length ? "選擇一筆刊登資料進行管理" : "目前沒有公開刊登資料",
      min_values: 1,
      max_values: 1,
      options: options.length ? options : [{ label: "目前沒有刊登資料", value: "none", description: "等待成員完成公開刊登" }],
      disabled: !options.length
    }]
  }];
}

export function matchProfileManageComponents(userId) {
  return [{
    type: 1,
    components: [
      { type: 2, style: 4, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:match-profile-remove:${userId}`, label: "撤下這筆刊登", emoji: { name: "🗑️" } },
      { type: 2, style: 2, custom_id: `${COMPONENT_IDS.ADMIN_PREFIX}:match-profiles`, label: "返回列表", emoji: { name: "↩️" } }
    ]
  }];
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
