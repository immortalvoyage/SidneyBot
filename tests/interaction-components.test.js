import assert from "node:assert/strict";
import test from "node:test";

import {
  applicationReviewComponents,
  dailyGreetingComponents,
  laozuListingConfirmComponents,
  parseApplicationReviewId,
  parseUidReviewId,
  uidReviewComponents
} from "../src/interactions/components.js";
import { handleButton } from "../src/interactions/buttons.js";
import { createApplication, reviewApplication } from "../src/sect/applications.js";
import { getApplication } from "../src/sect/applications.js";
import { getMember } from "../src/sect/members.js";
import { getPlayerState } from "../src/platform/player-state-storage.js";
import { getMatchProfile, saveMatchProfileDraft } from "../src/platform/laozu-matchmaking.js";
import { upsertMember } from "../src/sect/members.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "100000000000000001",
    BOT_MEMORY: {
      async get(key) {
        const value = values.get(key);
        return value === undefined ? null : JSON.parse(value);
      },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    }
  };
}

async function payload(response) {
  return JSON.parse(await response.text());
}

test("請安與入宗審核元件使用 Discord 原生按鈕", () => {
  const greeting = dailyGreetingComponents();
  const review = applicationReviewComponents("200000000000000002");
  assert.equal(greeting[0].components[0].type, 2);
  assert.equal(review[0].components.length, 2);
  assert.deepEqual(
    parseApplicationReviewId(review[0].components[0].custom_id),
    { decision: "approve", userId: "200000000000000002" }
  );
  assert.equal(applicationReviewComponents("200000000000000002", true)[0].components[0].disabled, true);
  const uidReview = uidReviewComponents("200000000000000002");
  assert.deepEqual(
    parseUidReviewId(uidReview[0].components[0].custom_id),
    { decision: "approve", userId: "200000000000000002" }
  );
  assert.equal(uidReviewComponents("200000000000000002", true)[0].components[1].disabled, true);
});

test("專長更新草稿提供確認與取消按鈕", () => {
  const buttons = laozuListingConfirmComponents("200000000000000002")[0].components;
  assert.deepEqual(buttons.map(item => item.label), ["確認更新", "取消更新"]);
  assert.deepEqual(buttons.map(item => item.style), [3, 2]);
});

test("專長更新按鈕只允許本人確認並實際寫入", async () => {
  const env = createEnv();
  const member = await upsertMember(env, {
    userId: "200000000000000002",
    username: "member",
    displayName: "一般成員",
    rank: "disciple"
  });
  await saveMatchProfileDraft(env, {
    guildId: "guild-1",
    member,
    draft: { skillList: ["Discord Bot"], availability: "週末", note: "可測試" }
  });

  const denied = await payload(await handleButton({
    guild_id: "guild-1",
    member: { user: { id: "300000000000000003" } },
    data: { custom_id: "sidney:laozu-listing:v1:confirm:200000000000000002" }
  }, env));
  assert.equal(denied.data.flags, 64);
  assert.equal(await getMatchProfile(env, "guild-1", member.userId), null);

  const confirmed = await payload(await handleButton({
    guild_id: "guild-1",
    member: { user: { id: member.userId } },
    data: { custom_id: "sidney:laozu-listing:v1:confirm:200000000000000002" }
  }, env));
  assert.equal(confirmed.type, 7);
  assert.deepEqual(confirmed.data.components, []);
  assert.match(confirmed.data.content, /已確認更新/);
  assert.equal((await getMatchProfile(env, "guild-1", member.userId)).skills, "Discord Bot");
});

test("非審核者點擊按鈕只收到私人拒絕訊息", async () => {
  const env = createEnv();
  await createApplication(env, {
    userId: "200000000000000002",
    username: "new.player",
    displayName: "新玩家"
  });
  const result = await payload(await handleButton({
    guild_id: "guild-1",
    member: { user: { id: "300000000000000003", username: "outsider" } },
    data: { custom_id: "sidney:application-review:v1:approve:200000000000000002" }
  }, env));

  assert.equal(result.type, 4);
  assert.equal(result.data.flags, 64);
  assert.match(result.data.content, /沒有審核.*權限/);
});

test("已完成申請不可由按鈕重複審核", async () => {
  const env = createEnv();
  await createApplication(env, {
    userId: "200000000000000002",
    username: "done.player",
    displayName: "已審玩家"
  });
  await reviewApplication(env, "200000000000000002", {
    status: "rejected",
    reviewedBy: "100000000000000001"
  });
  const result = await payload(await handleButton({
    guild_id: "guild-1",
    member: { user: { id: "100000000000000001", username: "master" } },
    data: { custom_id: "sidney:application-review:v1:reject:200000000000000002" }
  }, env));

  assert.equal(result.data.flags, 64);
  assert.match(result.data.content, /已完成審核/);
});

test("宗主按下同意後同步名冊與萬象錄並停用原訊息按鈕", async () => {
  const env = {
    ...createEnv(),
    DISCORD_BOT_TOKEN: "test-token",
    DISCORD_RESIDENT_ROLE_ID: "role-resident",
    DISCORD_DISCIPLE_ROLE_ID: "role-disciple",
    DISCORD_ELDER_ROLE_ID: "role-elder"
  };
  await createApplication(env, {
    userId: "200000000000000002",
    username: "new.player",
    displayName: "新玩家"
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes("/guilds/guild-1/members/")) {
      return new Response(JSON.stringify(init.method === "PATCH" ? {} : { roles: ["role-other"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (String(url).endsWith("/users/@me/channels")) {
      return new Response(JSON.stringify({ id: "dm-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ id: "message-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  let result;
  try {
    result = await payload(await handleButton({
      guild_id: "guild-1",
      member: { user: { id: "100000000000000001", username: "master", global_name: "宗主" } },
      data: { custom_id: "sidney:application-review:v1:approve:200000000000000002" },
      message: { content: "📨 新的入宗申請" }
    }, env));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(result.type, 7);
  assert.equal(result.data.components[0].components.every(button => button.disabled), true);
  assert.match(result.data.content, /已同意入宗/);
  assert.equal((await getApplication(env, "200000000000000002")).status, "approved");
  assert.equal((await getMember(env, "200000000000000002")).rank, "resident");
  assert.equal((await getPlayerState(env, "200000000000000002")).identity.displayName, "新玩家");
});
