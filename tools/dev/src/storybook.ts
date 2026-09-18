// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Effect } from "effect";

import { storybookPort } from "@template/config";

import type { LocalCommandFailure } from "./failure.ts";
import { root, run } from "./local-environment.ts";

function storybook(): Effect.Effect<void, LocalCommandFailure> {
  return run(
    path.join(root, "node_modules/.bin/vp"),
    ["exec", "storybook", "dev", "-p", String(storybookPort), "--no-open"],
    { cwd: path.join(root, "libs/ui") },
  ).pipe(Effect.asVoid);
}

export { storybook };
