import test from "node:test";
import assert from "node:assert/strict";
import { handleAdminInteraction } from "../src/interactions/admin-panel.js";
import { publishMatchProfile, getMatchProfile } from "../src/platform/laozu-matchmaking.js";
import { upsertMember } from "../src/sect/members.js";
import { RANK } from "../src/sect/constants.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "master-1",
    MASTER_ADMIN_CHANNEL_ID: "1534238116099919933",
    BOT_MEMORY: {
      async get(key, options) {
        const value = values.get(key);
        if (value === undefined) return null;
        if (typeof value !== "string") return value;
        try { return JSON.parse(value); } catch { return value; }
      },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    }
  };
}

function interaction(customId) {
  return {
    channel_id: "1534238116099919933",
    guild_id: "guild-1",
    member: { user: { id: "master-1", username: "master" } },
    data: { custom_id: customId }
  };
}

async function body(response) { return JSON.parse(await response.text()); }

test("宗主可查看已實際刊登的專長並撤下資料", async () => {
  const env = createEnv();
  const member = { userId: "200", username: "worker", displayName: "摸魚仙人", rank: RANK.DISCIPLE, active: true };
  await upsertMember(env, member);
  await publishMatchProfile(env, {
    guildId: "guild-1",
    member,
    skills: "打混摸魚、程式設計",
    availability: "隨時",
    consent: "AGREE"
  });

  const list = await body(await handleAdminInteraction(interaction("sidney:admin:v1:match-profiles"), env));
  assert.match(list.data.content, /摸魚仙人/);
  assert.match(list.data.content, /打混摸魚、程式設計/);
  assert.match(list.data.content, /實際已寫入媒合資料庫/);

  const selected = interaction("sidney:admin:v1:match-profile-select");
  selected.data.values = ["200"];
  const detail = await body(await handleAdminInteraction(selected, env));
  assert.match(detail.data.content, /專長刊登詳細資料/);
  assert.equal(detail.data.components[0].components[0].custom_id, "sidney:admin:v1:match-profile-remove:200");

  const removed = await body(await handleAdminInteraction(interaction("sidney:admin:v1:match-profile-remove:200"), env));
  assert.match(removed.data.content, /已由宗主管理介面撤下/);
  assert.equal(await getMatchProfile(env, "guild-1", "200"), null);
});
