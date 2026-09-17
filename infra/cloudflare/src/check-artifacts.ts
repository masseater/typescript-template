import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { loadArtifacts } from "./artifacts.ts";

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    for (const target of applications) {
      const artifacts = yield* loadArtifacts(root, target);
      // oxlint-disable-next-line no-console
      console.log(
        JSON.stringify({
          event: "artifacts.verified",
          mainModule: artifacts.mainModule,
          modules: artifacts.modules.length,
          privateAssetsExcluded: true,
          target,
        }),
      );
    }
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "artifacts.invalid" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
