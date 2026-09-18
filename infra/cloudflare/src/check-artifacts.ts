import path from "node:path";

import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@template/config";
import { Effect } from "effect";

import { loadArtifacts, repositoryRoot } from "./artifacts.ts";
import { FAILED_EXIT_CODE } from "./secrets.ts";

const report = (reason: string): Effect.Effect<void> => {
  return Effect.sync(() => {
    console.error(JSON.stringify({ event: "artifacts.invalid", reason }));
    process.exitCode = FAILED_EXIT_CODE;
  });
};

NodeRuntime.runMain(
  Effect.gen(function* program() {
    for (const target of applications) {
      const artifacts = yield* loadArtifacts(repositoryRoot, target);

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
