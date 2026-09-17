import { root, run } from "./local-environment.ts";
import { Effect } from "effect";
import type { LocalCommandFailure } from "./failure.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { storybookPort } from "@template/config";

const partsDirectory = "libs/ui";

function storybook(): Effect.Effect<void, LocalCommandFailure> {
  return run(
    path.join(root, "node_modules/.bin/vp"),
    ["exec", "storybook", "dev", "-p", String(storybookPort), "--no-open"],
    { cwd: path.join(root, partsDirectory) },
  ).pipe(Effect.asVoid);
}

export { storybook };
