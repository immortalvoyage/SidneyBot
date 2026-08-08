import test from "node:test";
import assert from "node:assert/strict";
import { attachMasterCrossPost, extractCrossPostChannelId } from "../src/integrations/discord-cross-post.js";

test("宗主或長老要求把訊息發到指定 Discord 頻道時可解析目標頻道", () => {
  assert.equal(
    extractCrossPostChannelId("訊息要發到 <#1531897588687704116> 不然他們看不到", "1534238116099919933"),
    "1531897588687704116"
  );
  assert.equal(extractCrossPostChannelId("請在這裡回覆 <#1531897588687704116>", "1534238116099919933"), "");
  assert.equal(
    extractCrossPostChannelId("幫我發個公告到 <#1534238116099919933>", "1534238116099919933"),
    "1534238116099919933"
  );
});

test("只有宗主與長老能取得公告發送動作", () => {
  const result = { ok: true, reply: "配對賽第二場急需人手支援！" };
  const base = { targetChannelId: "1531897588687704116" };

  for (const memberRank of ["master", "elder"]) {
    assert.deepEqual(attachMasterCrossPost(result, { ...base, memberRank }), {
      ...result,
      crossPost: {
        channelId: "1531897588687704116",
        content: "配對賽第二場急需人手支援！"
      }
    });
  }

  for (const memberRank of ["disciple", "resident", "pending", "outsider", ""]) {
    assert.equal(attachMasterCrossPost(result, { ...base, memberRank }), result);
  }
});
