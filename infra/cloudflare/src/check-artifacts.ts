import { Console, Effect } from "effect";
import { loadArtifacts, repositoryRoot } from "./artifacts.ts";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@repo/config";
import { markFailed } from "./secrets.ts";

function report(reason: string): Effect.Effect<void> {
  return Console.error(JSON.stringify({ event: "artifacts.invalid", reason })).pipe(
    Effect.andThen(markFailed),
  );
}

NodeRuntime.runMain(
  Effect.gen(function* program() {
    for (const target of applications) {
      yield* loadArtifacts(repositoryRoot, target);
    }
    yield* Console.log(
      JSON.stringify({ event: "artifacts.verified", targets: applications.length }),
    );
  }).pipe(
    Effect.catchTag("ArtifactFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("artifact_check_failed")),
  ),
  { disableErrorReporting: true },
);
