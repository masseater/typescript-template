import { storybookPort } from "@repo/config";
import { Effect, Path } from "effect";

import { root, run } from "./local-environment.ts";

import type { LocalCommandFailure } from "./failure.ts";

function storybook(): Effect.Effect<void, LocalCommandFailure, Path.Path> {
  return Effect.gen(function* storybookProgram() {
    const path = yield* Path.Path;
    yield* run(
      path.join(root, "node_modules/.bin/vp"),
      [
        "exec",
        "storybook",
        "dev",
        "--config-dir",
        "storybook",
        "-p",
        String(storybookPort),
        "--no-open",
      ],
      { cwd: path.join(root, "libs/ui") },
    );
  }).pipe(Effect.asVoid);
}

export { storybook };
