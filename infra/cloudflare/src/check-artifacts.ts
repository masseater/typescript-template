import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@template/config";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
import { loadArtifacts } from "./artifacts.ts";

function report(reason: string): Effect.Effect<void> {
  return Effect.sync(() => {
    // oxlint-disable-next-line no-console
    console.error(JSON.stringify({ event: "artifacts.invalid", reason }));
    process.exitCode = 1;
  });
}

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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catchTag("ArtifactFailure", (failure) => report(failure.code)),
    Effect.catchCause(() => report("artifact_check_failed")),
  ),
  { disableErrorReporting: true },
);
