import { loadArtifacts, repositoryRoot } from "./artifacts.ts";
import { Effect } from "effect";
import { FAILED_EXIT_CODE } from "./secrets.ts";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@template/config";

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
      yield* loadArtifacts(repositoryRoot, target);
    }
    // oxlint-disable-next-line no-console
    console.log(JSON.stringify({ event: "artifacts.verified", targets: applications.length }));
  }).pipe(
    Effect.catchTag("ArtifactFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("artifact_check_failed")),
  ),
  { disableErrorReporting: true },
);
