import { Console, Effect } from "effect";

import { applications } from "@repo/config";
import { reportFailed, runCli } from "@repo/config/cli";

import { loadArtifacts, repositoryRoot } from "./artifacts.ts";

function report(reason: string): Effect.Effect<void> {
  return reportFailed({ event: "artifacts.invalid", reason });
}

runCli(
  Effect.gen(function* program() {
    for (const target of applications) {
      yield* loadArtifacts(repositoryRoot, target);
    }
    yield* Console.log(
      JSON.stringify({ event: "artifacts.verified", targets: applications.length }),
    );
  }).pipe(Effect.catchTag("ArtifactFailure", (failure) => report(failure.code))),
  { event: "artifacts.invalid", reason: "artifact_check_failed" },
);
