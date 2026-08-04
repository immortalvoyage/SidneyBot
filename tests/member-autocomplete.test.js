import assert from "node:assert/strict";
import test from "node:test";

import { handleMemberAutocomplete } from "../src/commands/member-autocomplete.js";
import { handleMember } from "../src/commands/member.js";
import { GAME_IDS, GAME_KEYS } from "../src/platform/games/constants.js";
import { RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";

function createEnv(masterId = "master-1") {
  const values = new Map();
  return {
    SECT_MASTER_ID: masterId,
    BOT_MEMORY: {
      async get(key) {
        const value = values.get(key);
        return value === undefined ? null : JSON.parse(value);
      },
      async put(key, value) {
        values.set(key, value);
      },
      async delete(key) {
        values.delete(key);
      }
    }
  };
}

function interaction({
  type = 4,
  actorId = "master-1",
  subcommand = "get",
  value = "",
  focused = true
} = {}) {
  return {
    type,
    member: {
      user: {
        id: actorId,
        username: actorId,
        global_name: actorId === "master-1" ? "宗主" : actorId
      }
    },
    data: {
      name: "member",
      options: [{
        name: subcommand,
        type: 1,
        options: [{
          name: "player",
          type: 3,
          value,
          focused
        }]
      }]
    }
  };
}

async function responsePayload(response) {
  return JSON.parse(await response.text());
}

async function seed(env) {
  await upsertMember(env, {
    userId: "elder-1",
    username: "cloud.fox",
    displayName: "雲狐長老",
    rank: RANK.ELDER,
    joinedAt: "2026-01-01T00:00:00.000Z"
  });
  await upsertMember(env, {
    userId: "disciple-1",
    username: "moon.rabbit",
    displayName: "月兔弟子",
    rank: RANK.DISCIPLE,
    joinedAt: "2026-02-01T00:00:00.000Z"
  });
  await upsertMember(env, {
    userId: "pending-1",
    username: "pending",
    displayName: "待審玩家",
    rank: RANK.PENDING
  });
}

test("宗主可從仙遊者 KV 名冊搜尋正式成員", async () => {
  const env = createEnv();
  await seed(env);

  const payload = await responsePayload(
    await handleMemberAutocomplete(interaction({ value: "月兔" }), env)
  );

  assert.equal(payload.type, 8);
  assert.deepEqual(payload.data.choices, [
    { name: "月兔弟子｜門徒", value: "disciple-1" }
  ]);
});

test("調階與移除選單排除宗主和非正式成員", async () => {
  const env = createEnv();
  await seed(env);
  await upsertMember(env, {
    userId: "master-1",
    username: "master",
    displayName: "宗主",
    rank: RANK.MASTER
  });

  const payload = await responsePayload(
    await handleMemberAutocomplete(interaction({ subcommand: "remove" }), env)
  );
  const ids = payload.data.choices.map(item => item.value);

  assert.deepEqual(ids.sort(), ["disciple-1", "elder-1"]);
});

test("非宗主不能透過自動完成讀取名冊", async () => {
  const env = createEnv();
  await seed(env);

  const payload = await responsePayload(
    await handleMemberAutocomplete(interaction({ actorId: "elder-1" }), env)
  );

  assert.deepEqual(payload.data.choices, []);
});

test("/member get 顯示名冊資料與已核准燕雲綁定", async () => {
  const env = createEnv();
  await seed(env);
  await env.BOT_MEMORY.put(
    GAME_KEYS.ACCOUNT_BY_USER(GAME_IDS.WWM, "disciple-1"),
    JSON.stringify({
      userId: "disciple-1",
      uid: "123456789",
      currentCharacterName: "月下仙友",
      verified: true
    })
  );

  const payload = await responsePayload(
    await handleMember(interaction({
      type: 2,
      subcommand: "get",
      value: "disciple-1",
      focused: false
    }), env)
  );

  assert.equal(payload.type, 4);
  assert.match(payload.data.content, /月兔弟子/);
  assert.match(payload.data.content, /123456789/);
  assert.match(payload.data.content, /月下仙友/);
  assert.equal(payload.data.flags, 64);
});

test("/member get 拒絕不存在的名冊值與長老越權", async () => {
  const env = createEnv();
  await seed(env);

  const missing = await responsePayload(
    await handleMember(interaction({ type: 2, value: "missing", focused: false }), env)
  );
  assert.match(missing.data.content, /找不到該仙遊者成員/);

  const forbidden = await responsePayload(
    await handleMember(interaction({
      type: 2,
      actorId: "elder-1",
      value: "disciple-1",
      focused: false
    }), env)
  );
  assert.match(forbidden.data.content, /只有宗主/);
});
