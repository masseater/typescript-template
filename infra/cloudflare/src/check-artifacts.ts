import { loadArtifacts, repositoryRoot } from "./artifacts.ts";
import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@template/config";

NodeRuntime.runMain(
  Effect.gen(function* program() {
    for (const target of applications) {
      const artifacts = yield* loadArtifacts(repositoryRoot, target);
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
