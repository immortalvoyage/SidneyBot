import assert from "node:assert/strict";
import test from "node:test";

import { handleGameBindingAutocomplete } from "../src/commands/game-binding-autocomplete.js";
import { handleGame } from "../src/commands/game.js";
import { GAME_IDS } from "../src/platform/games/constants.js";
import {
  approveGameBinding,
  rejectGameBinding,
  requestGameBinding
} from "../src/platform/games/service.js";
import { RANK } from "../src/sect/constants.js";
import { getMember, removeMember, upsertMember } from "../src/sect/members.js";
import { handleButton } from "../src/interactions/buttons.js";

function createEnv(masterId = "master-1") {
  const values = new Map();
  return {
    SECT_MASTER_ID: masterId,
    DISCORD_BOT_TOKEN: "test-token",
    DISCORD_RESIDENT_ROLE_ID: "role-resident",
    DISCORD_DISCIPLE_ROLE_ID: "role-disciple",
    DISCORD_ELDER_ROLE_ID: "role-elder",
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

function autocompleteInteraction({ actorId = "master-1", action = "review", value = "" } = {}) {
  return {
    member: { user: { id: actorId, username: actorId } },
    data: {
      name: "game",
      options: [{
        name: action,
        type: 1,
        options: [{ name: "applicant", type: 3, value, focused: true }]
      }]
    }
  };
}

function commandInteraction(targetUserId, decision = null) {
  return {
    guild_id: "guild-1",
    member: { user: { id: "master-1", username: "master" } },
    data: {
      name: "game",
      options: [{
        name: "review",
        type: 1,
        options: [
          { name: "applicant", type: 3, value: targetUserId },
          ...(decision ? [{ name: "decision", type: 3, value: decision }] : [])
        ]
      }]
    }
  };
}

function bindInteraction(actorId, uid = "246801357", characterName = "領民角色") {
  return {
    guild_id: "guild-1",
    member: { user: { id: actorId, username: actorId } },
    data: {
      name: "game",
      options: [{
        name: "bind",
        type: 1,
        options: [
          { name: "uid", type: 3, value: uid },
          { name: "character_name", type: 3, value: characterName }
        ]
      }]
    }
  };
}

async function responsePayload(response) {
  return JSON.parse(await response.text());
}

async function seedPending(env, userId = "member-1") {
  await upsertMember(env, {
    userId,
    username: "moon.rabbit",
    displayName: "月兔",
    rank: RANK.DISCIPLE
  });
  return requestGameBinding(env, {
    gameId: GAME_IDS.WWM,
    userId,
    discordName: "月兔",
    uid: "123456789",
    characterName: "皓月"
  });
}

test("只有領民可提交 UID 綁定申請，門徒不需重複申請", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "resident-1",
    displayName: "新領民",
    rank: RANK.RESIDENT
  });
  await upsertMember(env, {
    userId: "disciple-1",
    displayName: "既有門徒",
    rank: RANK.DISCIPLE
  });

  const resident = await responsePayload(await handleGame(bindInteraction("resident-1"), env));
  const disciple = await responsePayload(await handleGame(bindInteraction("disciple-1"), env));

  assert.match(resident.data.content, /已提交《燕雲十六聲》角色綁定申請/);
  assert.match(disciple.data.content, /只供尚未綁定 UID 的領民使用/);
});

test("領民提交 UID 後把按鈕申請卡送到指定審核頻道", async () => {
  const env = {
    ...createEnv(),
    APPLICATION_REVIEW_CHANNEL_ID: "1533875614568812605"
  };
  await upsertMember(env, {
    userId: "resident-1",
    displayName: "新領民",
    rank: RANK.RESIDENT
  });
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init = {}) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ id: "review-message-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  try {
    await handleGame(bindInteraction("resident-1"), env);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(captured.url, /channels\/1533875614568812605\/messages$/);
  const body = JSON.parse(captured.init.body);
  assert.match(body.content, /UID 綁定申請/);
  assert.match(body.content, /246801357/);
  assert.equal(body.components[0].components.length, 2);
  assert.match(body.components[0].components[0].custom_id, /sidney:uid-review:v1:approve:resident-1/);
});

test("UID 審核按鈕拒絕未授權者，宗主同意後升為門徒並停用按鈕", async () => {
  const env = createEnv("100000000000000001");
  await upsertMember(env, {
    userId: "200000000000000002",
    username: "resident",
    displayName: "新領民",
    rank: RANK.RESIDENT
  });
  await requestGameBinding(env, {
    gameId: GAME_IDS.WWM,
    userId: "200000000000000002",
    discordName: "新領民",
    uid: "987654321",
    characterName: "雲遊"
  });
  const unauthorized = await responsePayload(await handleButton({
    guild_id: "guild-1",
    member: { user: { id: "300000000000000003", username: "outsider" } },
    data: { custom_id: "sidney:uid-review:v1:reject:200000000000000002" }
  }, env));
  assert.match(unauthorized.data.content, /沒有審核 UID 綁定申請的權限/);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/guilds/guild-1/members/")) {
      return new Response(JSON.stringify(init.method === "PATCH" ? {} : { roles: ["role-resident"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (String(url).endsWith("/users/@me/channels")) {
      return new Response(JSON.stringify({ id: "dm-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ id: "message-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  let approved;
  try {
    approved = await responsePayload(await handleButton({
      guild_id: "guild-1",
      member: { user: { id: "100000000000000001", username: "master", global_name: "宗主" } },
      data: { custom_id: "sidney:uid-review:v1:approve:200000000000000002" },
      message: { content: "🎮 UID 綁定申請" }
    }, env));
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(approved.type, 7);
  assert.match(approved.data.content, /已同意 UID 綁定/);
  assert.equal(approved.data.components[0].components.every(button => button.disabled), true);
  assert.equal((await getMember(env, "200000000000000002")).rank, RANK.DISCIPLE);
});

test("宗主與長老可從 KV 待審 UID 綁定搜尋，弟子不可讀取", async () => {
  const env = createEnv();
  await seedPending(env);
  await upsertMember(env, {
    userId: "elder-1",
    username: "elder",
    displayName: "長老",
    rank: RANK.ELDER
  });
  await upsertMember(env, {
    userId: "disciple-1",
    username: "disciple",
    displayName: "弟子",
    rank: RANK.DISCIPLE
  });

  const master = await responsePayload(await handleGameBindingAutocomplete(
    autocompleteInteraction({ value: "皓月" }), env
  ));
  const elder = await responsePayload(await handleGameBindingAutocomplete(
    autocompleteInteraction({ actorId: "elder-1", value: "123456" }), env
  ));
  const disciple = await responsePayload(await handleGameBindingAutocomplete(
    autocompleteInteraction({ actorId: "disciple-1" }), env
  ));

  assert.deepEqual(master.data.choices, [{
    name: "月兔｜UID 123456789｜皓月",
    value: "member-1"
  }]);
  assert.equal(elder.data.choices.length, 1);
  assert.deepEqual(disciple.data.choices, []);
});

test("已核准或拒絕的綁定不能再次處理", async () => {
  const approvedEnv = createEnv();
  await seedPending(approvedEnv);
  await approveGameBinding(approvedEnv, {
    gameId: GAME_IDS.WWM,
    userId: "member-1",
    reviewerId: "master-1"
  });
  await assert.rejects(
    approveGameBinding(approvedEnv, {
      gameId: GAME_IDS.WWM,
      userId: "member-1",
      reviewerId: "master-1"
    }),
    /已完成審核/
  );
  await assert.rejects(
    rejectGameBinding(approvedEnv, {
      gameId: GAME_IDS.WWM,
      userId: "member-1",
      reviewerId: "master-1"
    }),
    /已完成審核/
  );

  const rejectedEnv = createEnv();
  await seedPending(rejectedEnv);
  await rejectGameBinding(rejectedEnv, {
    gameId: GAME_IDS.WWM,
    userId: "member-1",
    reviewerId: "master-1"
  });
  await assert.rejects(
    rejectGameBinding(rejectedEnv, {
      gameId: GAME_IDS.WWM,
      userId: "member-1",
      reviewerId: "master-1"
    }),
    /已完成審核/
  );
});

test("申請者已被移出名冊時，執行階段拒絕核准綁定", async () => {
  const env = createEnv();
  await seedPending(env);
  await removeMember(env, "member-1");

  const payload = await responsePayload(
    await handleGame(commandInteraction("member-1"), env)
  );

  assert.match(payload.data.content, /不是仙遊者正式成員/);

  const autocomplete = await responsePayload(
    await handleGameBindingAutocomplete(autocompleteInteraction(), env)
  );
  assert.deepEqual(autocomplete.data.choices, []);
});

test("領民 UID 綁定核准後自動升為門徒並同步 Discord 身分組", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "resident-1",
    username: "resident",
    displayName: "新領民",
    rank: RANK.RESIDENT
  });
  await requestGameBinding(env, {
    gameId: GAME_IDS.WWM,
    userId: "resident-1",
    discordName: "新領民",
    uid: "987654321",
    characterName: "雲遊"
  });

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("/guilds/guild-1/members/")) {
      return new Response(JSON.stringify(init.method === "PATCH" ? {} : { roles: ["role-other", "role-resident"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (String(url).endsWith("/users/@me/channels")) {
      return new Response(JSON.stringify({ id: "dm-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ id: "message-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await responsePayload(await handleGame(commandInteraction("resident-1", "approve"), env));
    assert.match(result.data.content, /自動調整為門徒/);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal((await getMember(env, "resident-1")).rank, RANK.DISCIPLE);
  const patchCall = calls.find(call => call.init.method === "PATCH");
  assert.deepEqual(JSON.parse(patchCall.init.body), { roles: ["role-other", "role-disciple"] });
});
