import assert from "node:assert/strict";
import test from "node:test";

import { parseMasterEnrollmentDialogue } from "../src/commands/master-dialogue.js";
import { listAudits } from "../src/sect/audit.js";
import { RANK } from "../src/sect/constants.js";
import { getMember, upsertMember } from "../src/sect/members.js";
import { enrollMemberByMaster } from "../src/sect/service.js";

function createEnv() {
  const values = new Map();
  return {
    SECT_MASTER_ID: "1179245490081103994",
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

const master = {
  userId: "1179245490081103994",
  username: "master",
  displayName: "凜冬皓月",
  rank: RANK.MASTER
};

test("解析宗主新增弟子與長老的自然語言", () => {
  assert.deepEqual(
    parseMasterEnrollmentDialogue("將 <@123456789012345678> 加入仙遊者"),
    {
      action: "enroll",
      targetUserId: "123456789012345678",
      rank: RANK.DISCIPLE,
      note: "將 <@123456789012345678> 加入仙遊者"
    }
  );
  assert.equal(
    parseMasterEnrollmentDialogue("將 <@!123456789012345678> 加入仙遊者成為長老").rank,
    RANK.ELDER
  );
});

test("解析宗主移除成員的自然語言", () => {
  assert.deepEqual(
    parseMasterEnrollmentDialogue("將 <@123456789012345678> 移出仙遊者"),
    {
      action: "remove",
      targetUserId: "123456789012345678",
      rank: RANK.DISCIPLE,
      note: "將 <@123456789012345678> 移出仙遊者"
    }
  );
});

test("加入語句必須使用 Discord Mention", () => {
  assert.match(
    parseMasterEnrollmentDialogue("將梁淨加入仙遊者").error,
    /@ 提及/
  );
  assert.equal(parseMasterEnrollmentDialogue("今天天氣如何"), null);
});

test("宗主可直接加入弟子並保留未綁定 UID 狀態", async () => {
  const env = createEnv();
  let synced = null;
  const result = await enrollMemberByMaster(
    env,
    master,
    {
      id: "123456789012345678",
      username: "liangjing",
      displayName: "梁淨"
    },
    RANK.DISCIPLE,
    "宗主引薦",
    async (userId, rank) => {
      synced = { userId, rank };
      return { status: "success" };
    }
  );

  assert.equal(result.created, true);
  assert.deepEqual(synced, {
    userId: "123456789012345678",
    rank: RANK.DISCIPLE
  });
  assert.equal((await getMember(env, "123456789012345678")).displayName, "梁淨");
  const [audit] = await listAudits(env);
  assert.equal(audit.action, "member.enrolled_by_master_dialogue");
  assert.equal(audit.details.gameUidBound, false);
});

test("非宗主不得直接加入，既有成員不得重複建立", async () => {
  const env = createEnv();
  await assert.rejects(
    enrollMemberByMaster(env, { ...master, userId: "elder", rank: RANK.ELDER }, { id: "123456789012345678" }),
    /只有宗主/
  );

  await upsertMember(env, {
    userId: "123456789012345678",
    username: "liangjing",
    displayName: "原名稱",
    rank: RANK.DISCIPLE
  });
  const result = await enrollMemberByMaster(
    env,
    master,
    { id: "123456789012345678", username: "new", displayName: "新名稱" },
    RANK.ELDER
  );
  assert.equal(result.created, false);
  assert.equal(result.member.displayName, "原名稱");
  assert.deepEqual(await listAudits(env), []);
});
