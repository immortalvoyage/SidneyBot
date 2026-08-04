import assert from "node:assert/strict";
import test from "node:test";

import { handleButton } from "../src/interactions/buttons.js";
import { RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    SECT_NAME: "☯【仙遊者】☯",
    BOT_MEMORY: {
      async get(key) { const value = values.get(key); return value === undefined ? null : JSON.parse(value); },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    }
  };
}

function button(userId, customId, values) {
  return { data: { custom_id: customId, values }, member: { user: { id: userId, username: userId } } };
}

async function responseData(response) { return (await response.json()).data; }

test("名冊按鈕可翻頁、重新整理並維持私密互動", async () => {
  const env = createEnv();
  await upsertMember(env, { userId: "master-1", displayName: "凜冬皓月", rank: RANK.MASTER });
  for (let index = 1; index <= 12; index += 1) {
    await upsertMember(env, { userId: `member-${index}`, displayName: `門徒${index}`, rank: RANK.DISCIPLE });
  }
  const page = await responseData(await handleButton(button("member-1", "sidney:roster:v1:page:2"), env, {}));
  assert.match(page.content, /第 2\/2 頁/);
  assert.match(page.content, /門徒9|門徒10|門徒11|門徒12/);
  assert.equal(page.components[0].components[1].disabled, true);
});

test("查找玩家選單不顯示 Discord ID，選定後才顯示 UID 資料", async () => {
  const env = createEnv();
  await upsertMember(env, { userId: "master-1", displayName: "凜冬皓月", rank: RANK.MASTER });
  await upsertMember(env, { userId: "member-1", displayName: "夏之雪", rank: RANK.DISCIPLE });

  const finder = await responseData(await handleButton(button("member-1", "sidney:roster:v1:find:0"), env, {}));
  const options = finder.components[0].components[0].options;
  assert.ok(options.some(option => option.label === "夏之雪" && option.description === "門徒"));
  assert.ok(options.every(option => !option.label.includes("member-") && !option.description.includes("member-")));

  const detail = await responseData(await handleButton(button("member-1", "sidney:roster:v1:select:0", ["member-1"]), env, {}));
  assert.match(detail.content, /名稱：夏之雪/);
  assert.match(detail.content, /身分：門徒/);
  assert.match(detail.content, /UID：尚未綁定/);
});
