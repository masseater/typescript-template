import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { runAlchemy } from "./alchemy-cli.ts";
import { describeFailure } from "./secrets.ts";

const discard = { write: (): undefined => undefined };

const destructiveCommands = [
  ["unsafe", "nuke"],
  ["unsafe", "nuke", "--yes"],
  ["unsafe", "nuke", "--env-file", ".env"],
  ["destroy"],
  ["destroy", "--stage", "template"],
  ["provider", "cloudflare", "bootstrap", "--env-file", ".env", "unsafe", "nuke"],
];

it.effect("refuses every alchemy command outside the bootstrap allow list", () =>
  Effect.forEach(destructiveCommands, (command) =>
    Effect.gen(function* rejected() {
      const failure = yield* runAlchemy(command, [], {
        stderr: discard,
        stdout: discard,
      }).pipe(Effect.flip);
      assert.deepStrictEqual(describeFailure(failure, []), { code: "alchemy_command_rejected" });
    }),
  ),
);
