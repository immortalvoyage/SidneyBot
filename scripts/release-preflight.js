import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REQUIRED_ENV_KEYS = [
  "DISCORD_APPLICATION_ID",
  "DISCORD_BOT_TOKEN",
  "DISCORD_GUILD_ID"
];

export function parseEnvironmentKeys(content = "") {
  return new Set(String(content).split(/\r?\n/).map((line) => line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/)?.[1]).filter(Boolean));
}

export function evaluateReleaseState(state) {
  const checks = [
    [state.branch === "main", `目前分支是 main（實際：${state.branch || "未知"}）`],
    [Boolean(state.head) && state.head === state.originMain, "本機 HEAD 與 origin/main 一致"],
    [state.status.trim() === "", "Git 工作區乾淨"],
    [state.commandSource.includes('name: "memory"'), "已包含 /laozu memory 指令"],
    [state.archiveSource.includes('action === "delete_user"'), "Apps Script 已包含 delete_user"],
    [state.sharedEventsSource.includes('action: "delete_user"'), "Worker 已包含 delete_user 配套"],
    [REQUIRED_ENV_KEYS.every((key) => state.envKeys.has(key)), "本機 Discord 註冊環境變數齊全"]
  ];
  return checks.map(([ok, message]) => ({ ok, message }));
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function read(path) {
  return readFileSync(path, "utf8");
}

export function inspectReleaseState() {
  const envPath = ".dev.vars";
  return {
    branch: git("branch", "--show-current"),
    head: git("rev-parse", "HEAD"),
    originMain: git("rev-parse", "origin/main"),
    status: git("status", "--porcelain"),
    commandSource: read("register-commands.js"),
    archiveSource: read("LaozuEventArchive.js"),
    sharedEventsSource: read("src/platform/laozu-shared-events.js"),
    envKeys: parseEnvironmentKeys(existsSync(envPath) ? read(envPath) : "")
  };
}

function run() {
  const checks = evaluateReleaseState(inspectReleaseState());
  for (const check of checks) console.log(`${check.ok ? "✅" : "❌"} ${check.message}`);
  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    console.error(`\n發布前檢查未通過：${failed.length} 項。請先修正後再註冊或部署。`);
    process.exitCode = 1;
    return;
  }
  console.log("\n發布前狀態檢查通過；接著執行語法與完整回歸測試。" );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) run();
