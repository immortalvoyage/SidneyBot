import test from "node:test";
import assert from "node:assert/strict";

import {
  createChineseCommands,
  normalizeChineseInteraction
} from "../src/commands/localization.js";

test("creates Chinese command definitions without changing English definitions", () => {
  const english = [{
    name: "member",
    description: "member",
    options: [{
      name: "set-rank",
      description: "rank",
      type: 1,
      options: [{ name: "player", description: "player", type: 3 }]
    }]
  }];

  const chinese = createChineseCommands(english);

  assert.equal(chinese[0].name, "成員");
  assert.equal(chinese[0].options[0].name, "設定身分");
  assert.equal(chinese[0].options[0].options[0].name, "玩家");
  assert.equal(english[0].name, "member");
});

test("normalizes Chinese command, subcommand and option names", () => {
  const interaction = {
    data: {
      name: "成員",
      options: [{
        name: "設定身分",
        options: [
          { name: "玩家", value: "123" },
          { name: "身分", value: "elder" }
        ]
      }]
    }
  };

  const normalized = normalizeChineseInteraction(interaction);

  assert.equal(normalized.data.name, "member");
  assert.equal(normalized.data.options[0].name, "set-rank");
  assert.equal(normalized.data.options[0].options[0].name, "player");
  assert.equal(normalized.data.options[0].options[1].name, "rank");
});

test("leaves English interactions unchanged", () => {
  const interaction = { data: { name: "help" } };
  assert.equal(normalizeChineseInteraction(interaction), interaction);
});

test("localizes and normalizes the unified review command", () => {
  const english = [{
    name: "review",
    description: "review",
    options: [
      { name: "applicant", description: "applicant", type: 3 },
      { name: "decision", description: "decision", type: 3 }
    ]
  }];
  const [chinese] = createChineseCommands(english);

  assert.equal(chinese.name, "審核");
  assert.equal(chinese.options[0].name, "申請者");
  assert.equal(chinese.options[1].name, "決定");

  const normalized = normalizeChineseInteraction({
    data: {
      name: "審核",
      options: [
        { name: "申請者", value: "player-1" },
        { name: "決定", value: "approve" }
      ]
    }
  });
  assert.equal(normalized.data.name, "review");
  assert.equal(normalized.data.options[0].name, "applicant");
  assert.equal(normalized.data.options[1].name, "decision");
});
