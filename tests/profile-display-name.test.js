import assert from "node:assert/strict";
import test from "node:test";

import { handleCommand } from "../commands.js";
import { listAudits } from "../src/sect/audit.js";
import { RANK } from "../src/sect/constants.js";
import { getMember, upsertMember } from "../src/sect/members.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    APP_VERSION: "4.2.14",
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

function interaction(userId, action = "set-name", name = "凜冬皓月") {
  const options = action
    ? [{
        name: action,
        type: 1,
        options: action === "set-name"
          ? [{ name: "name", type: 3, value: name }]
          : []
      }]
    : [];

  return {
    data: { name: "profile", options },
    guild_id: "guild-1",
    member: { user: { id: userId, username: userId } }
  };
}

async function responseContent(response) {
  const payload = await response.json();
  assert.equal(payload.data.flags, 64);
  return payload.data.content;
}

test("正式成員可修改自己的仙遊者顯示名稱並寫入 Audit", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "member-1",
    username: "Sidney.Lin",
    displayName: "Sidney.Lin",
    rank: RANK.DISCIPLE
  });

  const content = await responseContent(
    await handleCommand(interaction("member-1"), env, {})
  );

  assert.match(content, /新名稱：凜冬皓月/);
  assert.equal((await getMember(env, "member-1")).displayName, "凜冬皓月");

  const [audit] = await listAudits(env);
  assert.equal(audit.action, "member.display_name_changed");
  assert.equal(audit.actorId, "member-1");
  assert.equal(audit.targetId, "member-1");
  assert.deepEqual(audit.details, {
    previousDisplayName: "Sidney.Lin",
    newDisplayName: "凜冬皓月"
  });
});

test("外人不能建立或修改仙遊者顯示名稱", async () => {
  const env = createEnv();
  const content = await responseContent(
    await handleCommand(interaction("outsider-1"), env, {})
  );
  assert.match(content, /只有仙遊者正式成員/);
  assert.equal(await getMember(env, "outsider-1"), null);
  assert.deepEqual(await listAudits(env), []);
});

test("名稱會整理空白並拒絕空白、過長、控制字元與 Discord 提及", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "member-1",
    displayName: "舊名稱",
    rank: RANK.DISCIPLE
  });

  const normalized = await responseContent(
    await handleCommand(interaction("member-1", "set-name", "  凜冬   皓月  "), env, {})
  );
  assert.match(normalized, /新名稱：凜冬 皓月/);

  for (const [name, expected] of [
    ["   ", /不可為空白/],
    ["月".repeat(33), /不可超過 32 個字/],
    ["月\n兔", /控制字元/],
    ["@everyone", /Discord 提及標記/],
    ["<@1234567890>", /Discord 提及標記/]
  ]) {
    const content = await responseContent(
      await handleCommand(interaction("member-1", "set-name", name), env, {})
    );
    assert.match(content, expected);
  }
});

test("相同名稱不重複寫入 Audit", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "member-1",
    displayName: "凜冬皓月",
    rank: RANK.ELDER
  });

  const content = await responseContent(
    await handleCommand(interaction("member-1"), env, {})
  );
  assert.match(content, /與目前名稱相同/);
  assert.deepEqual(await listAudits(env), []);
});

test("profile view 仍可查看更新後的宗門名稱", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "member-1",
    displayName: "凜冬皓月",
    rank: RANK.DISCIPLE
  });

  const content = await responseContent(
    await handleCommand(interaction("member-1", "view"), env, {})
  );
  assert.match(content, /名稱：凜冬皓月/);
});
