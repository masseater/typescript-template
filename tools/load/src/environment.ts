// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { loadavg } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import { Effect, Schedule, Schema } from "effect";

import { applicationPorts, applicationReadyPaths, applications } from "@repo/config";

class EnvironmentUnusable extends Schema.TaggedError<EnvironmentUnusable>()("EnvironmentUnusable", {
  reason: Schema.Literals([
    "build_missing",
    "file_io_failed",
    "origin_mismatch",
    "target_unreachable",
    "traces_not_cleared",
  ]),
}) {}

const Application = Schema.Literals(applications);
const root = fileURLToPath(new URL("../../../", import.meta.url));
const appOrigin = /^APP_ORIGIN="(?<origin>[^"]*)"$/mu;
const readinessChecks = 120;
const readinessInterval = "500 millis";
const loadAverageDigits = 2;

function targetOrigin(app: typeof Application.Type): string {
  return `http://127.0.0.1:${applicationPorts[app]}`;
}

function oneMinuteLoadAverage(): number {
  const [average = 0] = loadavg();
  return Number(average.toFixed(loadAverageDigits));
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function builtVariables(app: typeof Application.Type): Effect.Effect<string, EnvironmentUnusable> {
  return Effect.tryPromise({
    catch: (error) =>
      new EnvironmentUnusable({ reason: isMissing(error) ? "build_missing" : "file_io_failed" }),
    try: async () => readFile(path.join(root, "apps", app, "dist/server/.dev.vars"), "utf-8"),
  });
}

const requireLoopbackOrigin = Effect.fn("requireLoopbackOrigin")(function* requireLoopbackOrigin(
  app: typeof Application.Type,
) {
  const origin = targetOrigin(app);
  const variables = yield* builtVariables(app);
  if (appOrigin.exec(variables)?.groups?.["origin"] !== origin) {
    return yield* new EnvironmentUnusable({ reason: "origin_mismatch" });
  }
  return origin;
});

function answeredStatus(
  url: string,
  method: "GET" | "POST",
): Effect.Effect<number, EnvironmentUnusable> {
  return Effect.tryPromise({
    catch: () => new EnvironmentUnusable({ reason: "target_unreachable" }),
    try: async () => {
      const response = await fetch(url, { method, redirect: "manual" });
      await response.body?.cancel();
      return response.status;
    },
  });
}

function isSuccessful(status: number): boolean {
  const firstSuccess = 200;
  const firstRedirect = 300;
  return status >= firstSuccess && status < firstRedirect;
}

function awaitReady(app: typeof Application.Type): Effect.Effect<void, EnvironmentUnusable> {
  return answeredStatus(`${targetOrigin(app)}${applicationReadyPaths[app]}`, "GET").pipe(
    Effect.flatMap((status) =>
      isSuccessful(status)
        ? Effect.void
        : Effect.fail(new EnvironmentUnusable({ reason: "target_unreachable" })),
    ),
    Effect.retry({ schedule: Schedule.spaced(readinessInterval), times: readinessChecks }),
  );
}

function clearTraces(origin: string): Effect.Effect<void, EnvironmentUnusable> {
  return answeredStatus(
    `${origin}/cdn-cgi/local/explorer/api/local/observability/clear`,
    "POST",
  ).pipe(
    Effect.flatMap((status) =>
      isSuccessful(status)
        ? Effect.void
        : Effect.fail(new EnvironmentUnusable({ reason: "traces_not_cleared" })),
    ),
  );
}

export {
  Application,
  EnvironmentUnusable,
  awaitReady,
  clearTraces,
  oneMinuteLoadAverage,
  requireLoopbackOrigin,
  targetOrigin,
};
