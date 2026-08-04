const ENGLISH_TO_CHINESE = Object.freeze({
  ai: "詢問",
  apply: "申請",
  review: "審核",
  panel: "面板",
  members: "名冊",
  member: "成員",
  sect: "仙遊者",
  profile: "個人資料",
  forget: "忘記",
  game: "遊戲",
  audit: "稽核",
  system: "系統",
  help: "幫助",
  question: "問題",
  reason: "理由",
  applicant: "申請者",
  decision: "決定",
  note: "備註",
  page: "頁碼",
  get: "查看",
  "set-rank": "設定身分",
  player: "玩家",
  rank: "身分",
  remove: "移除",
  confirm: "確認",
  view: "查看",
  "set-name": "設定名稱",
  name: "名稱",
  bind: "綁定",
  uid: "遊戲uid",
  character_name: "角色名稱",
  status: "狀態",
  pending: "待審",
  recent: "最近",
  record: "紀錄",
  check: "檢查",
  repair: "修復"
});

const CHINESE_TO_ENGLISH = Object.freeze(
  Object.fromEntries(
    Object.entries(ENGLISH_TO_CHINESE).map(([english, chinese]) => [chinese, english])
  )
);

export function createChineseCommands(commands) {
  return commands.map(command => localizeDefinition(command));
}

export function normalizeChineseInteraction(interaction) {
  if (!interaction?.data || !CHINESE_TO_ENGLISH[interaction.data.name]) {
    return interaction;
  }

  return {
    ...interaction,
    data: normalizeData(interaction.data)
  };
}

function localizeDefinition(definition) {
  const localized = {
    ...definition,
    name: ENGLISH_TO_CHINESE[definition.name] || definition.name
  };

  if (definition.options) {
    localized.options = definition.options.map(option => localizeDefinition(option));
  }

  return localized;
}

function normalizeData(data) {
  const normalized = {
    ...data,
    name: CHINESE_TO_ENGLISH[data.name] || data.name
  };

  if (data.options) {
    normalized.options = data.options.map(option => normalizeData(option));
  }

  return normalized;
}
