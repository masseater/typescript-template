import { fileURLToPath } from "node:url";
import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { loadArtifacts } from "./artifacts.ts";

NodeRuntime.runMain(
  Effect.gen(function* () {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    for (const target of ["user", "admin", "wiki"] as const) {
      const artifacts = yield* loadArtifacts(root, target);
      console.log(
        JSON.stringify({
          event: "artifacts.verified",
          target,
          mainModule: artifacts.mainModule,
          modules: artifacts.modules.length,
          privateAssetsExcluded: true,
        }),
      );
    }
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(JSON.stringify({ event: "artifacts.invalid" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
