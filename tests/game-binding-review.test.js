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
import { removeMember, upsertMember } from "../src/sect/members.js";

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

function autocompleteInteraction({ actorId = "master-1", action = "approve", value = "" } = {}) {
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

function commandInteraction(targetUserId) {
  return {
    guild_id: "guild-1",
    member: { user: { id: "master-1", username: "master" } },
    data: {
      name: "game",
      options: [{
        name: "approve",
        type: 1,
        options: [{ name: "applicant", type: 3, value: targetUserId }]
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
