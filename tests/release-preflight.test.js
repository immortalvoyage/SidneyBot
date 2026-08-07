import test from "node:test";
import assert from "node:assert/strict";

import { evaluateReleaseState, parseEnvironmentKeys } from "../scripts/release-preflight.js";

function validState(overrides = {}) {
  return {
    branch: "main",
    head: "abc123",
    originMain: "abc123",
    status: "",
    commandSource: '{ name: "memory" }',
    archiveSource: 'if (request.payload.action === "delete_user") {}',
    sharedEventsSource: 'const payload = { action: "delete_user" };',
    envKeys: new Set(["DISCORD_APPLICATION_ID", "DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID"]),
    ...overrides
  };
}

test("發布前檢查不讀取或輸出環境變數值", () => {
  const keys = parseEnvironmentKeys("DISCORD_BOT_TOKEN=secret-value\nDISCORD_GUILD_ID = 123\n# COMMENT=x");
  assert.deepEqual([...keys], ["DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID"]);
  assert.equal(keys.has("secret-value"), false);
});

test("完整配套與乾淨 main 可通過發布前狀態檢查", () => {
  assert.equal(evaluateReleaseState(validState()).every((check) => check.ok), true);
});

test("阻擋過期主線、髒工作區及缺少 Discord 設定", () => {
  const checks = evaluateReleaseState(validState({
    head: "old",
    originMain: "new",
    status: " M discord.js",
    envKeys: new Set()
  }));
  assert.equal(checks.filter((check) => !check.ok).length, 3);
});
