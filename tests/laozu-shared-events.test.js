import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveSharedLaozuEvent,
  buildBehaviorObservations,
  extractMentionedUserIds,
  formatSharedEventContext,
  deleteOwnLaozuEvents,
  getLaozuMemoryPrivacy,
  loadSharedLaozuEvents,
  queryArchivedLaozuEvents,
  recordSharedLaozuEvent,
  setLaozuMemorySharing
} from "../src/platform/laozu-shared-events.js";
import { handleLaozuMemoryInteraction } from "../src/interactions/laozu-memory.js";

function memoryKv() {
  const values = new Map();
  return {
    async get(key, options) {
      const value = values.get(key);
      if (value === undefined) return null;
      return options?.type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); },
    async list({ prefix }) { return { keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })) }; }
  };
}

function memoryInteraction(action, userId = "111111") {
  return {
    guild_id: "999999",
    member: { user: { id: userId, username: userId } },
    data: { custom_id: `sidney:laozu-memory:v1:${action}` }
  };
}

async function responseData(response) { return JSON.parse(await response.text()).data; }

test("extracts mentioned players but excludes Laozu", () => {
  assert.deepEqual(
    extractMentionedUserIds("<@111111> 昨天綁架了 <@!222222> 和 <@222222>", "111111"),
    ["222222"]
  );
});

test("lets a player block their events from third-party shared context", async () => {
  const env = { BOT_MEMORY: memoryKv() };
  await recordSharedLaozuEvent(env, { guildId: "999999", actorId: "111111", participantIds: ["222222"], eventId: "private-choice-1", text: "不再對外分享" });
  await setLaozuMemorySharing(env, { guildId: "999999", userId: "111111", enabled: false });
  assert.deepEqual(await getLaozuMemoryPrivacy(env, { guildId: "999999", userId: "111111" }), { sharePublicEvents: false });
  assert.equal((await loadSharedLaozuEvents(env, { guildId: "999999", userIds: ["222222", "111111"] })).length, 0);
  assert.equal((await loadSharedLaozuEvents(env, { guildId: "999999", userIds: ["111111"] })).length, 1);
});

test("deletes only the requester's own KV and archived events", async () => {
  const env = { BOT_MEMORY: memoryKv(), LAOZU_EVENT_ARCHIVE_URL: "https://script.google.com/macros/s/example/exec", LAOZU_EVENT_ARCHIVE_SECRET: "test-secret" };
  await recordSharedLaozuEvent({ BOT_MEMORY: env.BOT_MEMORY }, { guildId: "999999", actorId: "111111", participantIds: [], eventId: "delete-me", text: "刪除我" });
  let sent;
  const result = await deleteOwnLaozuEvents(env, { guildId: "999999", userId: "111111" }, async (_url, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, async json() { return { ok: true }; } };
  });
  assert.deepEqual(result, { deleted: 1, archived: true });
  assert.equal(sent.payload.action, "delete_user");
  assert.equal(sent.payload.requesterId, "111111");
  assert.equal((await loadSharedLaozuEvents(env, { guildId: "999999", userIds: ["111111"] })).length, 0);
});

test("player memory panel toggles sharing and requires a second delete confirmation", async () => {
  const env = { BOT_MEMORY: memoryKv() };
  await recordSharedLaozuEvent(env, { guildId: "999999", actorId: "111111", participantIds: [], eventId: "owned-1", text: "我的紀錄" });
  const off = await responseData(await handleLaozuMemoryInteraction(memoryInteraction("sharing:off"), env));
  assert.match(off.content, /已關閉對外共享/);
  assert.match(off.content, /關閉/);
  const request = await responseData(await handleLaozuMemoryInteraction(memoryInteraction("delete-request"), env));
  assert.match(request.content, /確認刪除/);
  assert.equal(request.components[0].components[0].custom_id, "sidney:laozu-memory:v1:delete-confirm");
  assert.equal((await loadSharedLaozuEvents(env, { guildId: "999999", userIds: ["111111"] })).length, 1);
  const deleted = await responseData(await handleLaozuMemoryInteraction(memoryInteraction("delete-confirm"), env));
  assert.match(deleted.content, /KV 1 筆/);
  assert.equal((await loadSharedLaozuEvents(env, { guildId: "999999", userIds: ["111111"] })).length, 0);
});

test("player memory view only queries the requesting player's identity scope", async () => {
  const env = { BOT_MEMORY: memoryKv() };
  await recordSharedLaozuEvent(env, { guildId: "999999", actorId: "111111", participantIds: [], eventId: "mine", text: "只顯示我的事件" });
  await recordSharedLaozuEvent(env, { guildId: "999999", actorId: "222222", participantIds: [], eventId: "other", text: "不可顯示他人事件" });
  const view = await responseData(await handleLaozuMemoryInteraction(memoryInteraction("view"), env));
  assert.match(view.content, /只顯示我的事件/);
  assert.doesNotMatch(view.content, /不可顯示他人事件/);
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
