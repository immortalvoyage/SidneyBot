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
  assert.equal(detectLaozuConversationIntent("不知道有誰的專長是打混摸魚的，想找來陪我").asksForPeople, true);
  assert.equal(detectLaozuConversationIntent("我想學arduino該找誰").asksForPeople, true);
  assert.equal(detectLaozuConversationIntent("想學 Arduino 可以請教哪位仙友？").asksForPeople, true);
  assert.equal(detectLaozuConversationIntent("老祖妳能不能幫我記錄活動報名？").capabilityRequest, true);
});

test("辨識一般對話中的誤判與 BUG 回報為修正提案", () => {
  assert.equal(detectLaozuConversationIntent("你怎麼又繞進專長更新了？這個 BUG 能不能修正").problemReport, true);
  assert.equal(detectLaozuConversationIntent("那你先幫我繞過去啊，我現在就還沒改好").problemReport, true);
  assert.equal(detectLaozuConversationIntent("我的專長是程式設計").problemReport, false);
});

test("語意相近的能力需求會合併成同一筆", async () => {
  const storage = env();
  await recordCapabilitySuggestion(storage, {
    text: "妳以後能不能幫我們管理活動報名？",
    userId: "123",
    guildId: "456"
  });
  await recordCapabilitySuggestion(storage, {
    text: "老祖妳能不能管理活動？",
    userId: "789",
    guildId: "456"
  });
  const rows = await listCapabilitySuggestions(storage);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].count, 2);
});

test("能力建議可由宗主標記拒絕且相似需求不再重複加入", async () => {
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
    text: "妳可以幫我記錄活動報名嗎？",
    userId: "789",
    guildId: "456"
  });
  assert.equal(repeated, null);
});
