import assert from "node:assert/strict";
import test from "node:test";

import { handleCommand } from "../commands.js";
import { handleAuditAutocomplete } from "../src/commands/audit-autocomplete.js";
import { writeAudit } from "../src/sect/audit.js";
import { RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    APP_VERSION: "4.2.16",
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

function commandInteraction(userId, action, record = null) {
  return {
    data: {
      name: "audit",
      options: [{
        name: action,
        type: 1,
        options: record ? [{ name: "record", type: 3, value: record }] : []
      }]
    },
    guild_id: "guild-1",
    member: { user: { id: userId, username: userId } }
  };
}

function autocompleteInteraction(userId, query = "") {
  return {
    type: 4,
    data: {
      name: "audit",
      options: [{
        name: "view",
        type: 1,
        options: [{ name: "record", type: 3, value: query, focused: true }]
      }]
    },
    member: { user: { id: userId, username: userId } }
  };
}

async function payload(response) {
  return response.json();
}

test("宗主可私密查看最近 Audit，弟子不可查看", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "member-1",
    displayName: "凜冬皓月",
    rank: RANK.DISCIPLE
  });
  const record = await writeAudit(env, {
    action: "member.display_name_changed",
    actorId: "member-1",
    targetId: "member-1",
    details: { previousDisplayName: "Sidney.Lin", newDisplayName: "凜冬皓月" }
  });

  const master = await payload(await handleCommand(commandInteraction("master-1", "recent"), env, {}));
  assert.equal(master.data.flags, 64);
  assert.match(master.data.content, /最近 10 筆 Audit Log/);
  assert.match(master.data.content, /修改顯示名稱/);
  assert.match(master.data.content, /凜冬皓月/);
  assert.match(master.data.content, new RegExp(record.id));

  const disciple = await payload(await handleCommand(commandInteraction("member-1", "recent"), env, {}));
  assert.equal(disciple.data.flags, 64);
  assert.match(disciple.data.content, /只有宗主/);
  assert.doesNotMatch(disciple.data.content, new RegExp(record.id));
});

test("宗主可查看單筆 Audit 詳情並處理已移除對象", async () => {
  const env = createEnv();
  const record = await writeAudit(env, {
    action: "member.removed",
    actorId: "master-1",
    targetId: "former-1",
    details: {
      displayName: "舊弟子",
      previousRank: "disciple",
      note: "測試移除",
      gameBindingPreserved: true,
      discordRoleSync: { status: "updated" }
    }
  });

  const result = await payload(
    await handleCommand(commandInteraction("master-1", "view", record.id), env, {})
  );
  assert.equal(result.data.flags, 64);
  assert.match(result.data.content, /移除成員/);
  assert.match(result.data.content, /舊弟子/);
  assert.match(result.data.content, /測試移除/);
  assert.match(result.data.content, /保留遊戲綁定：是/);
  assert.match(result.data.content, /Discord 身分組同步：updated/);

  const missing = await payload(
    await handleCommand(commandInteraction("master-1", "view", "audit-missing"), env, {})
  );
  assert.match(missing.data.content, /找不到該 Audit 紀錄/);
});

test("Audit autocomplete 只向宗主顯示並可依對象搜尋", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "elder-1",
    displayName: "審核長老",
    rank: RANK.ELDER
  });
  await writeAudit(env, {
    action: "application.approved",
    actorId: "master-1",
    targetId: "former-1",
    details: { displayName: "目標仙友" }
  });

  const master = await payload(
    await handleAuditAutocomplete(autocompleteInteraction("master-1", "目標"), env)
  );
  assert.equal(master.type, 8);
  assert.equal(master.data.choices.length, 1);
  assert.match(master.data.choices[0].name, /核准入宗申請/);

  const elder = await payload(
    await handleAuditAutocomplete(autocompleteInteraction("elder-1", ""), env)
  );
  assert.deepEqual(elder.data.choices, []);
});

test("Audit 空紀錄時回覆明確狀態", async () => {
  const env = createEnv();
  const result = await payload(
    await handleCommand(commandInteraction("master-1", "recent"), env, {})
  );
  assert.match(result.data.content, /目前沒有可顯示的操作紀錄/);
});
