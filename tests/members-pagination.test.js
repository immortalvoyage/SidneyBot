import assert from "node:assert/strict";
import test from "node:test";

import { handleCommand } from "../commands.js";
import { RANK } from "../src/sect/constants.js";
import { PAGE_SIZE } from "../src/commands/members.js";
import { upsertMember } from "../src/sect/members.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    SECT_NAME: "☯【仙遊者】☯",
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

function interaction(userId, page) {
  return {
    data: {
      name: "members",
      options: page === undefined
        ? []
        : [{ name: "page", type: 4, value: page }]
    },
    member: { user: { id: userId, username: userId } }
  };
}

async function content(response) {
  return (await response.json()).data.content;
}

async function seedMembers(env, count = 32) {
  await upsertMember(env, {
    userId: "master-1",
    displayName: "宗主",
    rank: RANK.MASTER
  });
  for (let index = 1; index < count; index += 1) {
    await upsertMember(env, {
      userId: `member-${String(index).padStart(2, "0")}`,
      displayName: `成員${String(index).padStart(2, "0")}`,
      rank: index === 1 ? RANK.ELDER : RANK.DISCIPLE
    });
  }
}

test("/members 預設只顯示第一頁並提供下一頁提示", async () => {
  const env = createEnv();
  await seedMembers(env);

  const text = await content(await handleCommand(interaction("member-02"), env, {}));
  assert.match(text, /第 1\/3 頁｜共 32 人/);
  assert.match(text, /下一頁：`\/members page:2`/);
  assert.equal(text.split("\n").filter(line => /^\d+\./.test(line)).length, PAGE_SIZE);
  assert.ok(text.length < 2000);
});

test("/members 可查看指定頁並維持全名冊序號", async () => {
  const env = createEnv();
  await seedMembers(env);

  const text = await content(await handleCommand(interaction("member-02", 2), env, {}));
  assert.match(text, /第 2\/3 頁｜共 32 人/);
  assert.match(text, /^16\. /m);
  assert.match(text, /^30\. /m);
  assert.doesNotMatch(text, /^15\. /m);
});

test("/members 拒絕超出範圍頁碼且外人仍無法查看", async () => {
  const env = createEnv();
  await seedMembers(env);

  const invalid = await content(await handleCommand(interaction("member-02", 4), env, {}));
  assert.match(invalid, /頁碼超出範圍.*3 頁/);

  const denied = await content(await handleCommand(interaction("outsider", 1), env, {}));
  assert.match(denied, /只有宗門成員/);
});
