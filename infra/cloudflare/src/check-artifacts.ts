import { loadArtifacts, repositoryRoot } from "./artifacts.ts";
import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

function report(reason: string): Effect.Effect<void> {
  return Effect.sync(() => {
    // oxlint-disable-next-line no-console
    console.error(JSON.stringify({ event: "artifacts.invalid", reason }));
    process.exitCode = 1;
  });
}

NodeRuntime.runMain(
  Effect.gen(function* program() {
    for (const target of applications) {
      const artifacts = yield* loadArtifacts(repositoryRoot, target);
      // oxlint-disable-next-line no-console
      console.log(
        JSON.stringify({
          event: "artifacts.verified",
          mainModule: path.relative(repositoryRoot, artifacts.mainModule),
          modules: artifacts.modules.length,
          release: artifacts.release,
          target,
        }),
      );
    }
  }).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catchTag("ArtifactFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("artifact_check_failed")),
  ),
  { disableErrorReporting: true },
);
