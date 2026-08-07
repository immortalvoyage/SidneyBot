import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REQUIRED_CAPABILITIES = [
  "slashCommands",
  "laozuMemoryControls",
  "laozuSpeakerIdentityGrounding"
];

export function inspectHealthPayload(payload, expectedVersion) {
  const checks = [
    [payload?.ok === true, "Worker health 回報正常"],
    [payload?.service === "sidney-discord-worker", "服務身分正確"],
    [String(payload?.version || "") === expectedVersion, `Worker 版本為 ${expectedVersion}`],
    [REQUIRED_CAPABILITIES.every((key) => payload?.capabilities?.[key] === true), "記憶控制與人物識別能力已部署"]
  ];
  return checks.map(([ok, message]) => ({ ok, message }));
}

export function inspectRegisteredCommands(commands) {
  const laozu = Array.isArray(commands) ? commands.find((command) => command.name === "laozu") : null;
  const memory = laozu?.options?.find((option) => option.name === "memory" && option.type === 1);
  return [{ ok: Boolean(memory), message: "Discord 已註冊 /laozu memory" }];
}

export function resolveWorkerUrl(environment = process.env, packageJson = {}) {
  return String(environment.WORKER_PUBLIC_URL || packageJson.release?.workerPublicUrl || "").replace(/\/$/, "");
}

export function resolveDiscordRegistration(environment = process.env) {
  const applicationId = String(environment.DISCORD_APPLICATION_ID || "");
  const guildId = String(environment.DISCORD_GUILD_ID || "");
  const botToken = String(environment.DISCORD_BOT_TOKEN || "");
  return {
    applicationId,
    guildId,
    botToken,
    complete: Boolean(applicationId && guildId && botToken)
  };
}

function loadLocalEnvironment(path = ".dev.vars") {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function run() {
  loadLocalEnvironment();
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const workerUrl = resolveWorkerUrl(process.env, packageJson);
  if (!workerUrl) throw new Error("缺少 Worker 公開網址設定。");

  const health = await fetchJson(`${workerUrl}/healthz`);
  const checks = inspectHealthPayload(health, packageJson.version);
  const discord = resolveDiscordRegistration(process.env);
  if (discord.complete) {
    const commands = await fetchJson(`https://discord.com/api/v10/applications/${discord.applicationId}/guilds/${discord.guildId}/commands`, {
      headers: { Authorization: `Bot ${discord.botToken}` }
    });
    checks.push(...inspectRegisteredCommands(commands));
  } else {
    checks.push({
      ok: false,
      message: "Discord Guild 指令未驗證：請只在 Sidney 電腦的 .dev.vars 設定三項 Discord 註冊環境變數"
    });
  }
  for (const check of checks) console.log(`${check.ok ? "✅" : "❌"} ${check.message}`);
  if (checks.some((check) => !check.ok)) process.exitCode = 1;
  else console.log("\n正式 Worker 與 Discord 指令註冊驗證通過。");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(`❌ 部署後驗證失敗：${error.message}`);
    process.exitCode = 1;
  });
}
