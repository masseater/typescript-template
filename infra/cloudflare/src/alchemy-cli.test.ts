import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { runAlchemy } from "./alchemy-cli.ts";
import { describeFailure } from "./secrets.ts";

import type { AlchemyCommand } from "./alchemy-cli.ts";

const destructiveCommands = [
  ["unsafe", "nuke"],
  ["unsafe", "nuke", "--yes"],
  ["unsafe", "nuke", "--env-file", ".env"],
  ["destroy"],
  ["destroy", "--stage", "template"],
  ["provider", "cloudflare", "bootstrap", "--env-file", ".env", "unsafe", "nuke"],
];

function untyped(command: readonly string[]): AlchemyCommand {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the assertion builds an alchemy command outside the allow list so the refusal under test can see it
  return command as unknown as AlchemyCommand;
}

it.effect("refuses every alchemy command outside the bootstrap allow list", () =>
  Effect.forEach(destructiveCommands, (command) =>
    Effect.gen(function* rejected() {
      const failure = yield* runAlchemy(untyped(command), []).pipe(Effect.flip);
      assert.deepStrictEqual(describeFailure(failure, []), { code: "alchemy_command_rejected" });
    }),
  ),
);
