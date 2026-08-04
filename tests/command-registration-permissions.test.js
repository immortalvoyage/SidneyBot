import test from "node:test";
import assert from "node:assert/strict";
import { COMMANDS } from "../register-commands.js";

test("Discord registration leaves /game available to ordinary guild members", () => {
  const game = COMMANDS.find(command => command.name === "game");

  assert.ok(game, "/game must be registered");
  assert.equal(game.default_member_permissions, null);
  assert.equal(game.dm_permission, false);
  assert.deepEqual(
    game.options.map(option => option.name),
    ["bind", "status", "pending", "review"]
  );
});

test("all registered commands defer custom-role authorization to the Worker", () => {
  assert.ok(COMMANDS.length > 0);
  for (const command of COMMANDS) {
    assert.equal(command.default_member_permissions, null, `/${command.name}`);
  }
});
