import { Duration, Effect, FileSystem } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { failed, spelled } from "./journey-failure.ts";

const servingHealth = "serving";

const healthReport = (origin: string): Effect.Effect<string> => {
  const healthPath = "/api/health";
  const okStatus = 200;
  const requestTimeout = Duration.millis(120_000);
  return Effect.match(
    Effect.gen(function* readHealthReport() {
      const probe = yield* HttpClient.get(new URL(healthPath, origin).href).pipe(
        Effect.timeout(requestTimeout),
      );
      yield* probe.arrayBuffer.pipe(Effect.ignore);
      return probe.status === okStatus ? servingHealth : `E2E_HEALTH_STATUS ${probe.status}`;
    }).pipe(Effect.provide(FetchHttpClient.layer)),
    {
      onFailure: (cause) => `E2E_HEALTH_UNREACHABLE ${spelled(cause)}`,
      onSuccess: (report) => report,
    },
  );
};

const logTail = (file: string): Effect.Effect<string, never, FileSystem.FileSystem> => {
  const logTailLength = 10_000;
  return Effect.gen(function* readLogTail() {
    const filesystem = yield* FileSystem.FileSystem;
    return yield* Effect.match(filesystem.readFileString(file), {
      onFailure: (cause) => `E2E_LOG_UNREADABLE ${spelled(cause)}`,
      onSuccess: (recorded) => recorded.slice(-logTailLength),
    });
  });
};

const unavailable = (cause: unknown, tail: string): ReturnType<typeof failed> =>
  failed("E2E_APPLICATION_UNAVAILABLE", `${spelled(cause)} ${tail}`);

export { healthReport, logTail, servingHealth, unavailable };
