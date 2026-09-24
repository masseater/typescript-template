#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { causeRecord, firstUserArgumentIndex, reportFailed, runCli } from "@repo/cli";
import { repositoryRoot } from "@repo/config/repository-root";
import { Console, Effect, Path, Schema, type Scope } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { loadCiArguments } from "./load-arguments.ts";

class LoadCiFailure extends Schema.TaggedError<LoadCiFailure>()("LoadCiFailure", {
  reason: Schema.Literals(["load_failed", "preview_failed", "usage_invalid"]),
}) {}

const startPreview = (
  app: (typeof loadCiArguments.Type)["app"],
): Effect.Effect<
  void,
  LoadCiFailure,
  ChildProcessSpawner.ChildProcessSpawner | Path.Path | Scope.Scope
> => {
  return Effect.gen(function* launchPreview() {
    const paths = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    yield* spawner.spawn(
      ChildProcess.make("vp", ["preview"], {
        cwd: paths.join(repositoryRoot, "apps", app),
        stderr: "ignore",
        stdin: "ignore",
        stdout: "ignore",
      }),
    );
  }).pipe(Effect.mapError(() => new LoadCiFailure({ reason: "preview_failed" })));
};

const runLoad = (
  app: (typeof loadCiArguments.Type)["app"],
  profile: (typeof loadCiArguments.Type)["profile"],
): Effect.Effect<void, LoadCiFailure, ChildProcessSpawner.ChildProcessSpawner | Path.Path> => {
  return Effect.gen(function* measureLoad() {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const paths = yield* Path.Path;
    const loadCli = yield* paths.fromFileUrl(new URL("./cli.ts", import.meta.url));
    const exitCode = yield* spawner.exitCode(
      ChildProcess.make(loadCli, [app, profile], {
        cwd: repositoryRoot,
        stderr: "inherit",
        stdin: "inherit",
        stdout: "inherit",
      }),
    );
    if (exitCode !== 0) {
      return yield* new LoadCiFailure({ reason: "load_failed" });
    }
  }).pipe(Effect.mapError(() => new LoadCiFailure({ reason: "load_failed" })));
};

const runWithPreview = (
  selection: typeof loadCiArguments.Type,
): Effect.Effect<void, LoadCiFailure> =>
  Effect.scoped(
    Effect.gen(function* previewThenMeasure() {
      yield* startPreview(selection.app);
      yield* runLoad(selection.app, selection.profile);
    }),
  ).pipe(Effect.provide(NodeServices.layer));

const remediations: Readonly<Partial<Record<LoadCiFailure["reason"], string>>> = {
  usage_invalid:
    "vp run --filter @repo/load ci <service-member|service-admin|internal-dashboard> [smoke|peak]",
};

const announceFailure = (failed: {
  readonly reason: LoadCiFailure["reason"];
}): Effect.Effect<void> =>
  reportFailed({
    event: "load.ci_failed",
    ok: false,
    reason: failed.reason,
    ...(remediations[failed.reason] === undefined
      ? {}
      : { remediation: remediations[failed.reason] }),
  });

const finishedRecord = Schema.Struct({
  event: Schema.Literal("load.ci_finished"),
  ok: Schema.Literal(true),
});

const [app, profile] = process.argv.slice(firstUserArgumentIndex);

runCli(
  Schema.decodeUnknownEffect(loadCiArguments)(
    profile === undefined ? { app } : { app, profile },
  ).pipe(
    Effect.mapError(() => new LoadCiFailure({ reason: "usage_invalid" })),
    Effect.flatMap(runWithPreview),
    Effect.andThen(
      Schema.encodeEffect(Schema.fromJsonString(finishedRecord))({
        event: "load.ci_finished",
        ok: true,
      }),
    ),
    Effect.andThen(Console.log),
    Effect.catchTags({
      LoadCiFailure: announceFailure,
    }),
  ),
  (cause) => causeRecord("load.ci_failed", { cause, fields: { reason: "unexpected" } }),
);
