import assert from "node:assert/strict";
import test from "node:test";

import { handleSect } from "../src/commands/sect.js";
import { createApplication } from "../src/sect/applications.js";
import { RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    APP_VERSION: "4.2.12",
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

function interaction(userId) {
  return { member: { user: { id: userId, username: userId } } };
}

async function content(response) {
  return (await response.json()).data.content;
}

test("外人不能透過 /sect 讀取正式成員與待審數量", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "member-1",
    username: "member",
    displayName: "正式成員",
    rank: RANK.DISCIPLE
  });
  await createApplication(env, {
    userId: "pending-1",
    username: "pending",
    displayName: "待審玩家"
  });

  const result = await content(await handleSect(interaction("outsider-1"), env));
  assert.match(result, /只有仙遊者正式成員/);
  assert.doesNotMatch(result, /正式成員：|待審申請：/);
});

test("正式成員仍可私密查看 /sect 統計與自己的身分", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "member-1",
    username: "member",
    displayName: "正式成員",
    rank: RANK.DISCIPLE
  });

  const result = await content(await handleSect(interaction("member-1"), env));
  assert.match(result, /正式成員：1/);
  assert.match(result, /名稱：正式成員/);
});
