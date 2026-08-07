import test from "node:test";
import assert from "node:assert/strict";

import { inspectHealthPayload, inspectRegisteredCommands, resolveDiscordRegistration, resolveWorkerUrl } from "../scripts/post-deploy-verify.js";

test("部署後檢查要求正確版本、記憶控制與人物識別", () => {
  const checks = inspectHealthPayload({
    ok: true,
    service: "sidney-discord-worker",
    version: "4.3.22",
    capabilities: {
      slashCommands: true,
      laozuMemoryControls: true,
      laozuSpeakerIdentityGrounding: true
    }
  }, "4.3.22");
  assert.equal(checks.every((check) => check.ok), true);
  assert.equal(inspectHealthPayload({ ok: true }, "4.3.22").every((check) => check.ok), false);
});

test("部署後檢查確認 guild 已註冊 /laozu memory", () => {
  const valid = [{ name: "laozu", options: [{ name: "memory", type: 1 }] }];
  assert.equal(inspectRegisteredCommands(valid)[0].ok, true);
  assert.equal(inspectRegisteredCommands([{ name: "laozu", options: [] }])[0].ok, false);
});

test("部署後檢查可從公開發布設定取得 Worker URL，環境變數仍優先", () => {
  const packageJson = { release: { workerPublicUrl: "https://default.example.workers.dev/" } };
  assert.equal(resolveWorkerUrl({}, packageJson), "https://default.example.workers.dev");
  assert.equal(resolveWorkerUrl({ WORKER_PUBLIC_URL: "https://override.example.workers.dev/" }, packageJson), "https://override.example.workers.dev");
});

test("Discord 指令驗證只在三項註冊環境變數完整時啟用", () => {
  assert.equal(resolveDiscordRegistration({}).complete, false);
  assert.equal(resolveDiscordRegistration({
    DISCORD_APPLICATION_ID: "app",
    DISCORD_GUILD_ID: "guild",
    DISCORD_BOT_TOKEN: "token"
  }).complete, true);
});
