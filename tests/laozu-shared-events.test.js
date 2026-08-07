import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveSharedLaozuEvent,
  buildBehaviorObservations,
  extractMentionedUserIds,
  formatSharedEventContext,
  loadSharedLaozuEvents,
  queryArchivedLaozuEvents,
  recordSharedLaozuEvent
} from "../src/platform/laozu-shared-events.js";

function memoryKv() {
  const values = new Map();
  return {
    async get(key, options) {
      const value = values.get(key);
      if (value === undefined) return null;
      return options?.type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) { values.set(key, value); }
  };
}

test("extracts mentioned players but excludes Laozu", () => {
  assert.deepEqual(
    extractMentionedUserIds("<@111111> 昨天綁架了 <@!222222> 和 <@222222>", "111111"),
    ["222222"]
  );
});

test("shares a public event with actor and mentioned player", async () => {
  const env = { BOT_MEMORY: memoryKv() };
  await recordSharedLaozuEvent(env, {
    guildId: "999999",
    channelId: "888888",
    actorId: "111111",
    participantIds: ["222222"],
    eventId: "discord-event-1",
    text: "昨天我缺道具，所以跑去綁架了 <@222222>",
    createdAt: "2026-08-07T00:00:00.000Z"
  });
  const forTarget = await loadSharedLaozuEvents(env, { guildId: "999999", userIds: ["222222"] });
  assert.equal(forTarget.length, 1);
  assert.equal(forTarget[0].actorId, "111111");
  assert.match(formatSharedEventContext(forTarget, "222222"), /<@111111> 先前曾對老祖表示/);
  assert.match(formatSharedEventContext(forTarget, "222222"), /不代表已查證事實/);
});

test("stores own conversation even without another mentioned player", async () => {
  const env = { BOT_MEMORY: memoryKv() };
  const result = await recordSharedLaozuEvent(env, {
    guildId: "999999",
    actorId: "111111",
    participantIds: [],
    eventId: "discord-event-2",
    text: "老祖今天好嗎"
  });
  assert.equal(result.actorId, "111111");
  assert.deepEqual(result.participantIds, []);
  assert.equal(result.observations.questionCount, 0);
});

test("records evidence signals without turning them into personality verdicts", () => {
  const observations = buildBehaviorObservations("不好意思，謝謝妳！我可以接案嗎？");
  assert.equal(observations.questionCount, 1);
  assert.deepEqual(observations.signals, ["asks_question", "expresses_appreciation", "apologizes", "confirms_or_agrees", "career_or_capability_topic"]);
  assert.equal(Object.hasOwn(observations, "personality"), false);
});

test("archives shared events through a signed Google Sheets webhook", async () => {
  let sent;
  const event = { id: "message-archive-1", guildId: "999999", channelId: "888888", actorId: "111111", participantIds: ["222222"], text: "測試事件", source: "public_discord_mention", verification: "player_statement", createdAt: "2026-08-07T00:00:00.000Z" };
  const result = await archiveSharedLaozuEvent({ LAOZU_EVENT_ARCHIVE_URL: "https://script.google.com/macros/s/example/exec", LAOZU_EVENT_ARCHIVE_SECRET: "test-secret" }, event, async (url, options) => {
    sent = { url, body: JSON.parse(options.body) };
    return { ok: true, status: 200, async json() { return { ok: true }; } };
  });
  assert.equal(result.archived, true);
  assert.equal(sent.url, "https://script.google.com/macros/s/example/exec");
  assert.equal(sent.body.requestId, event.id);
  assert.equal(sent.body.payload.action, "append");
  assert.match(sent.body.signature, /^[a-f0-9]{64}$/);
});

test("queries long-term archive with signed bounded identity scope", async () => {
  let sent;
  const events = [{ id: "old-1", actorId: "111111", text: "歷史事件" }];
  const result = await queryArchivedLaozuEvents({ LAOZU_EVENT_ARCHIVE_URL: "https://script.google.com/macros/s/example/exec", LAOZU_EVENT_ARCHIVE_SECRET: "test-secret" }, { guildId: "999999", requesterId: "111111", userIds: ["111111", "222222"], limit: 99 }, async (url, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, async json() { return { ok: true, events }; } };
  });
  assert.deepEqual(result, events);
  assert.equal(sent.payload.action, "query");
  assert.equal(sent.payload.limit, 12);
  assert.equal(sent.payload.requesterId, "111111");
  assert.match(sent.signature, /^[a-f0-9]{64}$/);
});
