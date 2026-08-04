import assert from "node:assert/strict";
import test from "node:test";

import { RANK } from "../src/sect/constants.js";
import { syncDiscordMemberRank } from "../src/sect/discord-roles.js";

function env() {
  return {
    DISCORD_BOT_TOKEN: "token-1",
    DISCORD_RESIDENT_ROLE_ID: "role-resident",
    DISCORD_DISCIPLE_ROLE_ID: "role-disciple",
    DISCORD_ELDER_ROLE_ID: "role-elder"
  };
}

async function captureSync(rank, existingRoles = ["role-other", "role-disciple"]) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    if (!init.method) {
      return new Response(JSON.stringify({ roles: existingRoles }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(null, { status: 204 });
  };
  try {
    const result = await syncDiscordMemberRank(env(), "guild-1", "member-1", rank);
    return { calls, result };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("升任長老只替換仙遊者管理身分組並保留其他身分組", async () => {
  const { calls, result } = await captureSync(RANK.ELDER);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "https://discord.com/api/v10/guilds/guild-1/members/member-1");
  assert.equal(calls[1].init.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    roles: ["role-other", "role-elder"]
  });
  assert.equal(result.status, "success");
});

test("移除成員會撤銷領民、門徒與長老身分組但保留其他身分組", async () => {
  const { calls } = await captureSync(null, ["role-other", "role-elder"]);
  assert.deepEqual(JSON.parse(calls[1].init.body), { roles: ["role-other"] });
});

test("入宗核准只授予領民並撤銷其他仙遊者身分組", async () => {
  const { calls } = await captureSync(RANK.RESIDENT, ["role-other", "role-disciple"]);
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    roles: ["role-other", "role-resident"]
  });
});

test("身分組設定不完整時拒絕同步", async () => {
  await assert.rejects(
    syncDiscordMemberRank({ DISCORD_BOT_TOKEN: "token" }, "guild", "user", RANK.DISCIPLE),
    /身分組 ID/
  );
});
