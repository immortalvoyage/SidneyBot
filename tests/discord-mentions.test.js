import test from "node:test";
import assert from "node:assert/strict";
import { extractMentionQuestion, handleDiscordMentionEvent } from "../src/integrations/discord-mentions.js";

test("extracts normal and nickname Discord mentions", () => {
  assert.equal(extractMentionQuestion("<@123456789> 妳在嗎？", "123456789"), "妳在嗎？");
  assert.equal(extractMentionQuestion("請問 <@!123456789> 今天心情如何", "123456789"), "請問 今天心情如何");
  assert.equal(extractMentionQuestion("沒有提及", "bad"), "");
});

test("mention endpoint rejects unsigned events", async () => {
  const request = new Request("https://sidney.test/integrations/discord-mentions", { method: "POST", body: "{}" });
  const response = await handleDiscordMentionEvent(request, { DISCORD_GATEWAY_SECRET: "x".repeat(32) });
  assert.equal(response.status, 401);
});
