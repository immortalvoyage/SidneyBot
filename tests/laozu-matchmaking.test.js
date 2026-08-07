import test from "node:test";
import assert from "node:assert/strict";
import {
  createMatchInvitation,
  confirmMatchProfileDraft,
  findMatchProfiles,
  getMatchProfile,
  getMatchInvitation,
  normalizeSkills,
  parseMatchProfileDraft,
  publishMatchProfile,
  saveMatchProfileDraft,
  resolveMatchInvitation,
  withdrawMatchProfile
} from "../src/platform/laozu-matchmaking.js";

function env() {
  const values = new Map();
  return {
    BOT_MEMORY: {
      async get(key, options) {
        const value = values.get(key);
        return options?.type === "json" && value ? JSON.parse(value) : value ?? null;
      },
      async put(key, value) { values.set(key, value); },
      async delete(key) { values.delete(key); }
    }
  };
}

const members = [
  { userId: "1", displayName: "小月", active: true },
  { userId: "2", displayName: "丹青", active: true },
  { userId: "3", displayName: "長風", active: true },
  { userId: "4", displayName: "流光", active: true },
  { userId: "5", displayName: "墨白", active: true }
];

test("沒有明確同意時拒絕刊登媒合資料", async () => {
  await assert.rejects(
    publishMatchProfile(env(), {
      guildId: "guild",
      member: members[1],
      skills: "副本教學",
      availability: "晚上",
      consent: ""
    }),
    /明確選擇同意公開媒合/
  );
});

test("一位玩家可以同時刊登多項專長", async () => {
  assert.deepEqual(normalizeSkills("程式設計、打混摸魚，副本教學"), ["程式設計", "打混摸魚", "副本教學"]);
  const storage = env();
  const profile = await publishMatchProfile(storage, {
    guildId: "guild", member: members[1], skills: "程式設計、打混摸魚，副本教學",
    availability: "隨時", consent: "AGREE"
  });
  assert.deepEqual(profile.skillList, ["程式設計", "打混摸魚", "副本教學"]);
  assert.equal(profile.skills, "程式設計、打混摸魚、副本教學");
});

test("自然聊天可建立草稿並在確認後實際刊登", async () => {
  const storage = env();
  const draft = parseMatchProfileDraft("我擅長打混摸魚、程式設計，接案時間：隨時");
  assert.deepEqual(draft.skillList, ["打混摸魚", "程式設計"]);
  await saveMatchProfileDraft(storage, { guildId: "guild", member: members[1], draft });
  assert.equal(await getMatchProfile(storage, "guild", "2"), null);
  const published = await confirmMatchProfileDraft(storage, { guildId: "guild", member: members[1] });
  assert.equal(published.skills, "打混摸魚、程式設計");
  assert.equal((await getMatchProfile(storage, "guild", "2")).consent, true);
});

test("找人語句不可誤判成自己的專長刊登草稿", () => {
  assert.equal(parseMatchProfileDraft("最近好無聊，不知道有誰的專長是打混摸魚的，想找來陪我"), null);
  assert.equal(parseMatchProfileDraft("有誰擅長程式設計？我想找人幫忙"), null);
  assert.equal(parseMatchProfileDraft("我想找專長是剪輯的人"), null);
});

test("只媒合已同意公開且符合需求的其他成員", async () => {
  const storage = env();
  await publishMatchProfile(storage, {
    guildId: "guild", member: members[1], skills: "副本教學、裝備搭配",
    availability: "平日晚上", note: "新手也可以", consent: "AGREE"
  });
  await publishMatchProfile(storage, {
    guildId: "guild", member: members[2], skills: "拍照、外觀搭配",
    availability: "週末", consent: "AGREE"
  });
  const matches = await findMatchProfiles(storage, {
    guildId: "guild", requesterId: "1", need: "需要副本教學", members
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].userId, "2");
  assert.equal(matches[0].consent, true);
});

test("聊天說誰的專長是打混摸魚也能找到已刊登玩家", async () => {
  const storage = env();
  await publishMatchProfile(storage, {
    guildId: "guild", member: members[1], skills: "打混摸魚、程式設計",
    availability: "隨時", consent: "AGREE"
  });
  const matches = await findMatchProfiles(storage, {
    guildId: "guild", requesterId: "1", need: "最近好無聊，不知道有誰的專長是打混摸魚的，想找來陪我", members
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].userId, "2");
});

test("符合需求時依老祖好感度優先並最多回傳三人", async () => {
  const storage = env();
  for (const member of members.slice(1)) {
    await publishMatchProfile(storage, {
      guildId: "guild", member, skills: "程式設計 JavaScript",
      availability: "全天", consent: "AGREE"
    });
  }
  const favors = { "2": 20, "3": 90, "4": 50, "5": 70 };
  for (const [userId, favor] of Object.entries(favors)) {
    await storage.BOT_MEMORY.put(`platform:player-state:${userId}`, JSON.stringify({
      userId,
      identity: { displayName: userId },
      relationship: { favor, trust: 0 },
      greeting: {}
    }));
  }
  const matches = await findMatchProfiles(storage, {
    guildId: "guild", requesterId: "1", need: "我想找程式設計師", members
  });
  assert.deepEqual(matches.map(item => item.userId), ["3", "5", "4"]);
  assert.deepEqual(matches.map(item => item.favor), [90, 70, 50]);
});

test("撤回後立即不再出現在媒合結果", async () => {
  const storage = env();
  await publishMatchProfile(storage, {
    guildId: "guild", member: members[1], skills: "副本教學",
    availability: "晚上", consent: "AGREE"
  });
  await withdrawMatchProfile(storage, "guild", "2");
  const matches = await findMatchProfiles(storage, {
    guildId: "guild", requesterId: "1", need: "副本教學", members
  });
  assert.deepEqual(matches, []);
});

test("媒合邀請只有受邀者能接受，且不能重複回覆", async () => {
  const storage = env();
  await publishMatchProfile(storage, {
    guildId: "guild", member: members[1], skills: "程式設計",
    availability: "晚上", consent: "AGREE"
  });
  const invitation = await createMatchInvitation(storage, {
    guildId: "guild", requester: members[0], target: members[1], need: "協助 Discord Bot"
  });
  assert.equal(invitation.status, "pending");
  await assert.rejects(
    resolveMatchInvitation(storage, { guildId: "guild", invitationId: invitation.id, targetId: "3", accept: true }),
    /只有受邀者/
  );
  const accepted = await resolveMatchInvitation(storage, {
    guildId: "guild", invitationId: invitation.id, targetId: "2", accept: true
  });
  assert.equal(accepted.status, "accepted");
  assert.equal((await getMatchInvitation(storage, {
    guildId: "guild", invitationId: invitation.id, viewerId: "1"
  })).status, "accepted");
  await assert.rejects(
    resolveMatchInvitation(storage, { guildId: "guild", invitationId: invitation.id, targetId: "2", accept: false }),
    /已經回覆過/
  );
});

test("未公開刊登者不可被邀請，第三方不可讀取邀請", async () => {
  const storage = env();
  await assert.rejects(
    createMatchInvitation(storage, {
      guildId: "guild", requester: members[0], target: members[1], need: "協助剪輯"
    }),
    /沒有同意公開媒合/
  );
  await publishMatchProfile(storage, {
    guildId: "guild", member: members[1], skills: "影片剪輯",
    availability: "週末", consent: "AGREE"
  });
  const invitation = await createMatchInvitation(storage, {
    guildId: "guild", requester: members[0], target: members[1], need: "協助剪輯"
  });
  await assert.rejects(
    getMatchInvitation(storage, { guildId: "guild", invitationId: invitation.id, viewerId: "3" }),
    /只有邀請雙方/
  );
});
