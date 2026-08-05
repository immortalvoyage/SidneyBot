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

function interaction(userId, topic = null) {
  return {
    data: {
      name: "help",
      options: topic ? [{ name: "topic", value: topic }] : []
    },
    member: { user: { id: userId, username: userId } }
  };
}

async function helpContent(env, userId, topic = null) {
  const response = await handleCommand(interaction(userId, topic), env, {});
  const payload = await response.json();
  assert.equal(payload.data.flags, 64);
  return payload.data.content;
}

test("外人只看到入宗與個人指令", async () => {
  const content = await helpContent(createEnv(), "outsider-1");
  assert.match(content, /你的身分：\*\*尚未入宗\*\*/);
  assert.match(content, /\/apply/);
  assert.doesNotMatch(content, /\/profile set-name|\/ai question|\/members|\/review|\/member get|\/game bind/);
  assert.doesNotMatch(content, /\/幫助|\/個人資料|\/遊戲|\/詢問/);
});

test("領民看到 UID 綁定申請，且不看到審核與管理指令", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "resident-1",
    displayName: "領民",
    rank: RANK.RESIDENT
  });
  const content = await helpContent(env, "resident-1");
  assert.match(content, /你的身分：\*\*領民\*\*/);
  assert.match(content, /\/game bind|\/game status/);
  assert.doesNotMatch(content, /\/apply|\/review|\/game pending|\/member get/);
});

test("門徒只看到已綁定成員功能，不再看到 UID 綁定申請", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "disciple-1",
    displayName: "弟子",
    rank: RANK.DISCIPLE
  });
  const content = await helpContent(env, "disciple-1");
  assert.match(content, /你的身分：\*\*門徒\*\*/);
  assert.match(content, /\/profile view|\/ai|\/members|\/game status/);
  assert.doesNotMatch(content, /\/profile set-name|\/forget/);
  assert.doesNotMatch(content, /\/game bind/);
  assert.doesNotMatch(content, /\/apply|\/review|\/game pending|\/member get/);
});

test("長老看到審核功能，但看不到宗主管理指令", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "elder-1",
    displayName: "長老",
    rank: RANK.ELDER
  });
  const content = await helpContent(env, "elder-1");
  assert.match(content, /你的身分：\*\*長老\*\*/);
  assert.match(content, /審核工作/);
  assert.doesNotMatch(content, /\/review|\/game pending/);
  assert.doesNotMatch(content, /\/game bind|\/member get|\/member set-rank|\/member remove/);
});

test("設定中的宗主自動建檔並看到完整管理功能", async () => {
  const env = createEnv();
  const content = await helpContent(env, "master-1");
  assert.match(content, /你的身分：\*\*宗主\*\*/);
  assert.match(content, /宗主管理|系統維護/);
  assert.doesNotMatch(content, /\/member get|\/member set-rank|\/member remove|\/system repair/);
  assert.doesNotMatch(content, /\/apply|\/game bind|\/幫助|\/詢問/);
});

test("宗主管理與系統維護分頁不混在首頁", async () => {
  const env = createEnv();
  const admin = await helpContent(env, "master-1", "admin");
  assert.match(admin, /\/member get|\/member set-rank|\/member remove|\/laozu reprimand/);
  assert.doesNotMatch(admin, /\/system check|\/system repair|\/review/);

  const system = await helpContent(env, "master-1", "system");
  assert.match(system, /\/system check|\/system repair/);
  assert.doesNotMatch(system, /\/member get|\/member remove|\/review/);
});

test("玩家不能透過分類選項查看高階指令", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "disciple-2",
    displayName: "門徒",
    rank: RANK.DISCIPLE
  });
  const content = await helpContent(env, "disciple-2", "admin");
  assert.match(content, /此分類目前無法使用/);
  assert.doesNotMatch(content, /\/member|get|set-rank|\/laozu|\/system/);
});
