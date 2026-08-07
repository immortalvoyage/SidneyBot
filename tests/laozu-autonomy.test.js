import test from "node:test";
import assert from "node:assert/strict";
import {
  detectLaozuConversationIntent,
  listCapabilitySuggestions,
  recordCapabilitySuggestion,
  resolveCapabilitySuggestion
} from "../src/platform/laozu-autonomy.js";

function env() {
  const values = new Map();
  return {
    BOT_MEMORY: {
      async get(key, options) {
        const value = values.get(key);
        return options?.type === "json" && value ? JSON.parse(value) : value ?? null;
      },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); },
      async list({ prefix, limit = 100 }) {
        const keys = [...values.keys()].filter(key => key.startsWith(prefix)).slice(0, limit).map(name => ({ name }));
        return { keys };
      }
    }
  };
}

test("辨識換工作、找人與平台能力需求", () => {
  assert.equal(detectLaozuConversationIntent("最近想換個工作，也許接點兼職").career, true);
  assert.equal(detectLaozuConversationIntent("我想找程式設計師幫忙做網站").asksForPeople, true);
  assert.equal(detectLaozuConversationIntent("老祖妳能不能幫我記錄活動報名？").capabilityRequest, true);
});

test("能力建議可由宗主標記拒絕且不再重複加入", async () => {
  const storage = env();
  const first = await recordCapabilitySuggestion(storage, {
    text: "老祖妳能不能幫我記錄活動報名？",
    userId: "123",
    guildId: "456"
  });
  assert.ok(first?.id);
  assert.equal((await listCapabilitySuggestions(storage)).length, 1);

  await resolveCapabilitySuggestion(storage, first.id, "rejected");
  assert.equal((await listCapabilitySuggestions(storage)).length, 0);

  const repeated = await recordCapabilitySuggestion(storage, {
    text: "老祖妳能不能幫我記錄活動報名？",
    userId: "789",
    guildId: "456"
  });
  assert.equal(repeated, null);
});
