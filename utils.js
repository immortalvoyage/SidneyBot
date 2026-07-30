export function getOptionValue(interaction, name) {
  return (
    interaction?.data?.options || []
  ).find(option => option.name === name)?.value;
}

export function getUser(interaction) {
  return interaction?.member?.user || interaction?.user || {};
}

export function getUserId(interaction) {
  return String(getUser(interaction).id || "");
}

export function getDisplayName(interaction) {
  return String(
    interaction?.member?.nick ||
    getUser(interaction).global_name ||
    getUser(interaction).username ||
    "未知仙友"
  );
}

export function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error || "未知錯誤");
}

export function truncate(text, limit = 1800) {
  const value = String(text || "");
  return value.length <= limit
    ? value
    : value.slice(0, limit - 1) + "…";
}

export function nowIso() {
  return new Date().toISOString();
}

export function randomId(prefix = "id") {
  return `${prefix}_${Date.now()}_${crypto.randomUUID()}`;
}
