import test from "node:test";
import assert from "node:assert/strict";

import { inspectHealthPayload, inspectRegisteredCommands } from "../scripts/post-deploy-verify.js";

test("部署後檢查要求正確版本、記憶控制與人物識別", () => {
  const checks = inspectHealthPayload({
    ok: true,
    service: "sidney-discord-worker",
    version: "4.3.22",
    capabilities: {
      slashCommands: true,
      laozuMemoryControls: true,
      laozuSpeakerIdentityGrounding: true
    }
  }, "4.3.22");
  assert.equal(checks.every((check) => check.ok), true);
  assert.equal(inspectHealthPayload({ ok: true }, "4.3.22").every((check) => check.ok), false);
});

test("部署後檢查確認 guild 已註冊 /laozu memory", () => {
  const valid = [{ name: "laozu", options: [{ name: "memory", type: 1 }] }];
  assert.equal(inspectRegisteredCommands(valid)[0].ok, true);
  assert.equal(inspectRegisteredCommands([{ name: "laozu", options: [] }])[0].ok, false);
});
