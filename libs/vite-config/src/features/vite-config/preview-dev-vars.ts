import { Effect } from "effect";

import { filesystem, isNotFound, paths } from "./host.ts";

import type { Plugin } from "vite-plus";

const readDevVars = (appRoot: string): Effect.Effect<string | undefined> =>
  filesystem.readFileString(paths.join(appRoot, ".dev.vars")).pipe(
    Effect.catchIf(isNotFound, () => Effect.as(Effect.void, undefined as string | undefined)),
    Effect.orDie,
  );

const previewDevVars = (appRoot: string): Plugin => ({
  apply: "build",
  applyToEnvironment: (environment: Readonly<{ name: string }>) => environment.name === "ssr",
  generateBundle() {
    const emitDevVarsFile = (
      file: Readonly<{ fileName: string; source: string; type: "asset" }>,
    ): void => {
      this.emitFile(file);
    };
    const reportMissingDevVars = (missingDevVarsText: string): void => {
      this.error(missingDevVarsText);
    };
    return Effect.runPromise(
      Effect.gen(function* emitDevVars() {
        const source = yield* readDevVars(appRoot);
        if (source === undefined) {
          reportMissingDevVars(
            `Missing ${paths.join(appRoot, ".dev.vars")}; run vp run --filter @repo/dev setup before building for preview`,
          );
          return;
        }
        emitDevVarsFile({ fileName: ".dev.vars", source, type: "asset" });
      }),
    );
  },
  name: "template-preview-dev-vars",
});

export { previewDevVars };
