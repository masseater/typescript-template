import { readFile } from "node:fs/promises";
import { loadavg } from "node:os";
import path from "node:path";

import { type Application, applicationOrigins, applicationReadyPaths } from "@repo/config";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, Schedule, Schema } from "effect";

const readinessChecks = 120;
const readinessInterval = "500 millis";
const loadAverageDigits = 2;

const oneMinuteLoadAverage = (): number => {
  const [average = 0] = loadavg();
  return Number(average.toFixed(loadAverageDigits));
};

const isMissing = (thrown: unknown): boolean => {
  return (
    typeof thrown === "object" && thrown !== null && "code" in thrown && thrown.code === "ENOENT"
  );
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

const builtVariables = (app: Application): Effect.Effect<string, EnvironmentUnusable> => {
  return Effect.tryPromise({
    catch: (unread) =>
      new EnvironmentUnusable({ reason: isMissing(unread) ? "build_missing" : "file_io_failed" }),
    try: async () =>
      readFile(path.join(repositoryRoot, "apps", app, "dist/server/.dev.vars"), "utf-8"),
  });
};

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

const answeredStatus = (
  url: string,
  method: "GET" | "POST",
): Effect.Effect<number, EnvironmentUnusable> => {
  return Effect.tryPromise({
    catch: () => new EnvironmentUnusable({ reason: "target_unreachable" }),
    try: async () => {
      const answered = await fetch(url, { method, redirect: "manual" });
      await answered.body?.cancel();
      return answered.status;
    },
  });
};

const isSuccessful = (answeredCode: number): boolean => {
  const firstSuccess = 200;
  const firstRedirect = 300;
  return answeredCode >= firstSuccess && answeredCode < firstRedirect;
};

const awaitReady = (app: Application): Effect.Effect<void, EnvironmentUnusable> => {
  return answeredStatus(`${applicationOrigins[app]}${applicationReadyPaths[app]}`, "GET").pipe(
    Effect.flatMap((answeredCode) =>
      isSuccessful(answeredCode)
        ? Effect.void
        : Effect.fail(new EnvironmentUnusable({ reason: "target_unreachable" })),
    ),
    Effect.retry({ schedule: Schedule.spaced(readinessInterval), times: readinessChecks }),
  );
};

const clearTraces = (origin: string): Effect.Effect<void, EnvironmentUnusable> => {
  return answeredStatus(
    `${origin}/cdn-cgi/local/explorer/api/local/observability/clear`,
    "POST",
  ).pipe(
    Effect.flatMap((answeredCode) =>
      isSuccessful(answeredCode)
        ? Effect.void
        : Effect.fail(new EnvironmentUnusable({ reason: "traces_not_cleared" })),
    ),
  );
};

export {
  EnvironmentUnusable,
  awaitReady,
  clearTraces,
  oneMinuteLoadAverage,
  requireLoopbackOrigin,
};
