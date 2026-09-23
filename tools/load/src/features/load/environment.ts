import { loadavg } from "node:os";

import { NodeServices } from "@effect/platform-node";
import {
  type Application,
  applicationOrigins,
  applicationReadyPaths,
  respondedSuccessfully,
  waitUntilResponds,
} from "@repo/config";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Path, Schema } from "effect";

const readinessChecks = 120;
const readinessInterval = "500 millis";
const loadAverageDigits = 2;

const oneMinuteLoadAverage = (): number => {
  const [average = 0] = loadavg();
  return Number(average.toFixed(loadAverageDigits));
};

class EnvironmentUnusable extends Schema.TaggedError<EnvironmentUnusable>()("EnvironmentUnusable", {
  reason: Schema.Literals([
    "build_missing",
    "file_io_failed",
    "origin_mismatch",
    "target_unreachable",
    "traces_not_cleared",
  ]),
}) {}

const builtVariables = (app: Application): Effect.Effect<string, EnvironmentUnusable> =>
  Effect.gen(function* readBuiltVariables() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const variablesPath = paths.join(repositoryRoot, "apps", app, "dist/server/.dev.vars");
    if (!(yield* filesystem.exists(variablesPath).pipe(Effect.orElseSucceed(() => false)))) {
      return yield* new EnvironmentUnusable({ reason: "build_missing" });
    }
    return yield* filesystem
      .readFileString(variablesPath)
      .pipe(Effect.mapError(() => new EnvironmentUnusable({ reason: "file_io_failed" })));
  }).pipe(Effect.provide(NodeServices.layer));

const appOrigin = /^APP_ORIGIN="(?<origin>[^"]*)"$/mu;

const requireLoopbackOrigin = Effect.fn("requireLoopbackOrigin")(function* requireLoopbackOrigin(
  app: Application,
) {
  const origin = applicationOrigins[app];
  const variables = yield* builtVariables(app);
  if (appOrigin.exec(variables)?.groups?.origin !== origin) {
    return yield* new EnvironmentUnusable({ reason: "origin_mismatch" });
  }
  return origin;
});

const awaitReady = (app: Application): Effect.Effect<void, EnvironmentUnusable> => {
  return waitUntilResponds({
    accept: respondedSuccessfully,
    method: "GET",
    onStatus: () => new EnvironmentUnusable({ reason: "target_unreachable" }),
    onUnreachable: () => new EnvironmentUnusable({ reason: "target_unreachable" }),
    retry: { interval: readinessInterval, times: readinessChecks },
    url: `${applicationOrigins[app]}${applicationReadyPaths[app]}`,
  }).pipe(Effect.asVoid);
};

const clearTraces = (origin: string): Effect.Effect<void, EnvironmentUnusable> => {
  return waitUntilResponds({
    accept: respondedSuccessfully,
    method: "POST",
    onStatus: () => new EnvironmentUnusable({ reason: "traces_not_cleared" }),
    onUnreachable: () => new EnvironmentUnusable({ reason: "target_unreachable" }),
    url: `${origin}/cdn-cgi/local/explorer/api/local/observability/clear`,
  }).pipe(Effect.asVoid);
};

export {
  EnvironmentUnusable,
  awaitReady,
  clearTraces,
  oneMinuteLoadAverage,
  requireLoopbackOrigin,
};
