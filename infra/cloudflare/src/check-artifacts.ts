import { loadArtifacts, repositoryRoot } from "./artifacts.ts";
import { Effect } from "effect";
import { FAILED_EXIT_CODE } from "./secrets.ts";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

function report(reason: string): Effect.Effect<void> {
  return Effect.sync(() => {
    // oxlint-disable-next-line no-console
    console.error(JSON.stringify({ event: "artifacts.invalid", reason }));
    process.exitCode = FAILED_EXIT_CODE;
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
    Effect.catchTag("ArtifactFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("artifact_check_failed")),
  ),
  { disableErrorReporting: true },
);
