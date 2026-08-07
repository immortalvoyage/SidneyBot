import assert from "node:assert/strict";
import test from "node:test";

import { handleButton } from "../src/interactions/buttons.js";
import { matchInvitationComponents, parseMatchInvitationId } from "../src/interactions/components.js";
import { createMatchInvitation, publishMatchProfile } from "../src/platform/laozu-matchmaking.js";

function env() {
  const values = new Map();
  return { BOT_MEMORY: {
    async get(key) { const value = values.get(key); return value ? JSON.parse(value) : null; },
    async put(key, value) { values.set(key, value); },
    async delete(key) { values.delete(key); }
  } };
}

test("媒合按鈕攜帶原伺服器與邀請編號", () => {
  const customId = matchInvitationComponents("invite123", "guild456")[0].components[0].custom_id;
  assert.deepEqual(parseMatchInvitationId(customId), {
    decision: "accept", guildId: "guild456", invitationId: "invite123"
  });
});

test("受邀者可在私人訊息按鈕接受原伺服器邀請", async () => {
  const storage = env();
  await publishMatchProfile(storage, {
    guildId: "guild456",
    member: { userId: "target", displayName: "受邀者", active: true },
    skills: "程式設計", availability: "晚上", consent: "AGREE"
  });
  const invitation = await createMatchInvitation(storage, {
    guildId: "guild456",
    requester: { userId: "requester", displayName: "邀請者", active: true },
    targetUserId: "target", need: "程式設計"
  });
  const response = await handleButton({
    data: { custom_id: matchInvitationComponents(invitation.id, "guild456")[0].components[0].custom_id },
    member: { user: { id: "target" } },
    message: { content: "私人邀請" }
  }, storage, {});
  const body = await response.json();
  assert.equal(body.type, 7);
  assert.match(body.data.content, /已接受/);
  assert.equal(body.data.components[0].components[0].disabled, true);
});
