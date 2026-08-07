import test from "node:test";
import assert from "node:assert/strict";
import { buildHealthPayload, handleHealthRequest } from "../src/integrations/health.js";

test("health payload reports deployed capabilities without exposing secrets", () => {
  const payload = buildHealthPayload({
    APP_VERSION: "4.3.22",
    SIDNEY_STATE_API_TOKEN: "state-secret",
    DISCORD_GATEWAY_SECRET: "gateway-secret"
  });
  assert.equal(payload.ok, true);
  assert.equal(payload.version, "4.3.22");
  assert.deepEqual(payload.capabilities, {
    slashCommands: true,
    laozuMemoryControls: true,
    laozuSpeakerIdentityGrounding: true,
    laozuMoodState: true,
    laozuMentions: true,
    redeemAnnouncements: false
  });
  assert.equal(JSON.stringify(payload).includes("gateway-secret"), false);
});

test("health response is public and never cached", async () => {
  const response = handleHealthRequest({ APP_VERSION: "4.3.22" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).service, "sidney-discord-worker");
});
