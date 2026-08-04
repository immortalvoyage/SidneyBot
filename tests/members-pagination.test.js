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

async function data(response) {
  return (await response.json()).data;
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

test("/members 使用分組手機排版並提供互動按鈕", async () => {
  const env = createEnv();
  await seedMembers(env);

  const result = await data(await handleCommand(interaction("member-02"), env, {}));
  assert.match(result.content, /共 32 人/);
  assert.match(result.content, /宗主 1｜長老 1｜門徒 30｜領民 0/);
  assert.match(result.content, /第 1\/4 頁/);
  assert.match(result.content, /【宗主】[\s\S]*👑 宗主/);
  assert.doesNotMatch(result.content, /member-\d|Discord ID|^\d+\./m);
  assert.equal(result.content.split("\n").filter(line => ["👑 ", "🌙 ", "⚔️ ", "🌱 "].some(prefix => line.startsWith(prefix))).length, PAGE_SIZE);
  assert.deepEqual(result.components[0].components.map(button => button.label), ["上一頁", "下一頁", "查找玩家", "重新整理"]);
  assert.equal(result.components[0].components[0].disabled, true);
  assert.equal(result.components[0].components[1].disabled, false);
});

test("/members 可查看指定頁並維持每頁十人", async () => {
  const env = createEnv();
  await seedMembers(env);

  const result = await data(await handleCommand(interaction("member-02", 2), env, {}));
  assert.match(result.content, /第 2\/4 頁/);
  assert.match(result.content, /⚔️ 成員10/);
  assert.match(result.content, /⚔️ 成員19/);
  assert.doesNotMatch(result.content, /成員09|成員20/);
  assert.equal(result.components[0].components[0].disabled, false);
});

test("/members 拒絕超出範圍頁碼且外人仍無法查看", async () => {
  const env = createEnv();
  await seedMembers(env);

  const invalid = (await data(await handleCommand(interaction("member-02", 5), env, {}))).content;
  assert.match(invalid, /頁碼超出範圍.*4 頁/);

  const denied = (await data(await handleCommand(interaction("outsider", 1), env, {}))).content;
  assert.match(denied, /只有仙遊者成員/);
});
