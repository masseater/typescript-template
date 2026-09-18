import { Console, Effect } from "effect";
import { loadArtifacts, repositoryRoot } from "./artifacts.ts";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@template/config";
import { markFailed } from "./secrets.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

function report(reason: string): Effect.Effect<void> {
  return Console.error(JSON.stringify({ event: "artifacts.invalid", reason })).pipe(
    Effect.andThen(markFailed),
  );
}

NodeRuntime.runMain(
  Effect.gen(function* program() {
    for (const target of applications) {
      const artifacts = yield* loadArtifacts(repositoryRoot, target);
      yield* Console.log(
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
