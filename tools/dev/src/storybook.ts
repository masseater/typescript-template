import path from "node:path";

import { storybookPort } from "@repo/config";
import { Effect } from "effect";

import { root, run } from "./local-environment.ts";

import type { LocalCommandFailure } from "./failure.ts";

function storybook(): Effect.Effect<void, LocalCommandFailure> {
  return run(
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
  ).pipe(Effect.asVoid);
}

export { storybook };
