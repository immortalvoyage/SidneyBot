import test from "node:test";
import assert from "node:assert/strict";

import { inspectHealthPayload, inspectRegisteredCommands, resolveArchiveVerification, resolveDiscordRegistration, resolveWorkerUrl, verifyArchiveEndpoint } from "../scripts/post-deploy-verify.js";

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

test("Apps Script 驗證只在 URL 與 Secret 完整時啟用", () => {
  assert.equal(resolveArchiveVerification({}).complete, false);
  assert.equal(resolveArchiveVerification({ LAOZU_EVENT_ARCHIVE_URL: "https://script.google.com/exec", LAOZU_EVENT_ARCHIVE_SECRET: "secret" }).complete, true);
});

test("Apps Script 健康探測使用簽章且不傳送玩家資料", async () => {
  let sent;
  const checks = await verifyArchiveEndpoint({ url: "https://script.google.com/exec", secret: "secret" }, async (url, options) => {
    sent = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ ok: true, service: "laozu-event-archive", capabilities: { deleteUser: true } }) };
  });
  assert.equal(checks[0].ok, true);
  assert.equal(sent.body.payload.action, "health");
  assert.equal("userId" in sent.body.payload, false);
  assert.match(sent.body.signature, /^[a-f0-9]{64}$/);
});
