import assert from "node:assert/strict";
import test from "node:test";

import { handleApplicationAutocomplete } from "../src/commands/application-autocomplete.js";
import { createApplication } from "../src/sect/applications.js";
import { RANK } from "../src/sect/constants.js";
import { upsertMember } from "../src/sect/members.js";
import { sendChannelMessage } from "../discord.js";
import { approveApplicant } from "../src/sect/service.js";
import { getApplication } from "../src/sect/applications.js";
import { getMember } from "../src/sect/members.js";

function createEnv(masterId = "master-1") {
  const values = new Map();
  return {
    SECT_MASTER_ID: masterId,
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

function interaction({ actorId = "master-1", command = "approve", value = "" } = {}) {
  return {
    member: {
      user: {
        id: actorId,
        username: actorId,
        global_name: actorId === "master-1" ? "宗主" : actorId
      }
    },
    data: {
      name: command,
      options: [{
        name: "applicant",
        type: 3,
        value,
        focused: true
      }]
    }
  };
}

async function payload(response) {
  return JSON.parse(await response.text());
}

test("宗主可從 KV 待審申請搜尋申請者", async () => {
  const env = createEnv();
  await createApplication(env, {
    userId: "applicant-1",
    username: "moon.rabbit",
    displayName: "月兔",
    reason: "想和大家一起玩"
  });

  const result = await payload(
    await handleApplicationAutocomplete(interaction({ value: "月兔" }), env)
  );

  assert.deepEqual(result.data.choices, [{
    name: "月兔｜想和大家一起玩",
    value: "applicant-1"
  }]);
});

test("長老可讀取待審選單，弟子不可讀取", async () => {
  const env = createEnv();
  await upsertMember(env, {
    userId: "elder-1",
    username: "elder",
    displayName: "長老",
    rank: RANK.ELDER
  });
  await upsertMember(env, {
    userId: "disciple-1",
    username: "disciple",
    displayName: "弟子",
    rank: RANK.DISCIPLE
  });
  await createApplication(env, {
    userId: "applicant-1",
    username: "new.player",
    displayName: "新玩家"
  });

  const elder = await payload(await handleApplicationAutocomplete(
    interaction({ actorId: "elder-1" }), env
  ));
  const disciple = await payload(await handleApplicationAutocomplete(
    interaction({ actorId: "disciple-1" }), env
  ));

  assert.equal(elder.data.choices.length, 1);
  assert.deepEqual(disciple.data.choices, []);
});

test("已完成審核的申請不會出現在待審選單", async () => {
  const env = createEnv();
  const created = await createApplication(env, {
    userId: "applicant-1",
    username: "done.player",
    displayName: "已處理玩家"
  });
  created.application.status = "approved";
  await env.BOT_MEMORY.put(
    "sect:application:applicant-1",
    JSON.stringify(created.application)
  );

  const result = await payload(
    await handleApplicationAutocomplete(interaction(), env)
  );
  assert.deepEqual(result.data.choices, []);
});

test("審核頻道通知使用 Bot Token 且停用 mentions", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url, init };
    return new Response(JSON.stringify({ id: "message-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    await sendChannelMessage("channel-1", "token-1", "新的申請");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(captured.url, "https://discord.com/api/v10/channels/channel-1/messages");
  assert.equal(captured.init.headers.Authorization, "Bot token-1");
  assert.deepEqual(JSON.parse(captured.init.body), {
    content: "新的申請",
    allowed_mentions: { parse: [] }
  });
});

test("核准時 Discord 身分組同步失敗不建立成員或完成申請", async () => {
  const env = createEnv();
  await createApplication(env, {
    userId: "applicant-1",
    username: "new.player",
    displayName: "新玩家"
  });
  const actor = {
    userId: "master-1",
    username: "master",
    displayName: "宗主",
    rank: RANK.MASTER
  };

  await assert.rejects(
    approveApplicant(env, actor, "applicant-1", "", async () => {
      throw new Error("Discord HTTP 403");
    }),
    /Discord HTTP 403/
  );
  assert.equal(await getMember(env, "applicant-1"), null);
  assert.equal((await getApplication(env, "applicant-1")).status, "pending");
});
