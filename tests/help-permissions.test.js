import assert from "node:assert/strict";
import test from "node:test";

import { handleCommand } from "../commands.js";
import { RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    SECT_NAME: "仙遊者",
    APP_VERSION: "4.2.13",
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
  return {
    data: { name: "help" },
    member: { user: { id: userId, username: userId } }
  };
}

async function helpContent(env, userId) {
  const response = await handleCommand(interaction(userId), env, {});
  const payload = await response.json();
  assert.equal(payload.data.flags, 64);
  return payload.data.content;
}

test("外人只看到入宗與個人指令", async () => {
  const content = await helpContent(createEnv(), "outsider-1");
  assert.match(content, /你的身分：尚未入宗/);
  assert.match(content, /\/apply/);
  assert.doesNotMatch(content, /\/profile set-name|\/ai question|\/members|\/approve|\/member get|\/game bind/);
});

test("弟子只看到正式成員功能，不看到審核與管理指令", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "disciple-1",
    displayName: "弟子",
    rank: RANK.DISCIPLE
  });
  const content = await helpContent(env, "disciple-1");
  assert.match(content, /你的身分：弟子/);
  assert.match(content, /\/profile set-name|\/ai question|\/members|\/game bind/);
  assert.doesNotMatch(content, /\/apply|\/approve|\/reject|\/game pending|\/member get/);
});

test("長老看到審核功能，但看不到宗主管理指令", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "elder-1",
    displayName: "長老",
    rank: RANK.ELDER
  });
  const content = await helpContent(env, "elder-1");
  assert.match(content, /你的身分：長老/);
  assert.match(content, /\/approve|\/reject|\/game pending/);
  assert.doesNotMatch(content, /\/member get|\/member set-rank|\/member remove/);
});

test("設定中的宗主自動建檔並看到完整管理功能", async () => {
  const env = createEnv();
  const content = await helpContent(env, "master-1");
  assert.match(content, /你的身分：宗主/);
  assert.match(content, /\/approve|\/game pending|\/member get|\/member set-rank|\/member remove/);
  assert.doesNotMatch(content, /\/apply/);
});
