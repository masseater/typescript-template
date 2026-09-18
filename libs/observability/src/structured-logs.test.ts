import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { annotateLogs } from "./annotations.ts";
import { Telemetry } from "./telemetry.ts";
import { recordingSink } from "./testing.ts";

const leaked = "structured-log-test-value-at-least-32-characters";

function recorded(program: Effect.Effect<void>): Effect.Effect<ReturnType<typeof recordingSink>> {
  const logs = recordingSink();
  return program.pipe(
    Effect.provide(
      Telemetry.layer({
        log: logs.sink,
        release: "abc123",
        routes: { "/": "home" },
        serviceName: "user",
      }),
    ),
    Effect.orDie,
    Effect.as(logs),
  );
}

it.effect("hides a secret an authentication failure puts in its attributes", () =>
  Effect.gen(function* program() {
    const logs = yield* recorded(
      Effect.logError("authentication.failed", {
        cause: {
          AUTH_SECRET: leaked,
          headers: `authorization: Bearer ${leaked}`,
          reason: "invalid token",
        },
      }),
    );
    assert.notInclude(JSON.stringify(logs.stderr), leaked);
    assert.deepStrictEqual(logs.stderr, [
      {
        cause: {
          AUTH_SECRET: "[redacted]",
          headers: "authorization: [redacted]",
          reason: "invalid token",
        },
        event: "authentication.failed",
        release: "abc123",
        service: "user-server",
      },
    ]);
  }),
);

it.effect("keeps the error that broke the model readable while hiding the secret it carries", () =>
  Effect.gen(function* program() {
    const logs = yield* recorded(
      Effect.logWarning("interview.model_failed", {
        cause: new Error(`D1_ERROR: no such table: jwks (AUTH_SECRET=${leaked})`),
        reason: "model_failed",
      }),
    );
    assert.notInclude(JSON.stringify(logs.stdwarn), leaked);
    assert.deepStrictEqual(logs.stdwarn, [
      {
        cause: {
          message: "D1_ERROR: no such table: jwks (AUTH_SECRET=[redacted])",
          name: "Error",
        },
        event: "interview.model_failed",
        reason: "model_failed",
        release: "abc123",
        service: "user-server",
      },
    ]);
  }),
);

it.effect("hides a secret an annotation carries, not only the attributes of the call", () =>
  Effect.gen(function* program() {
    const logs = yield* recorded(
      Effect.logInfo("http.server.request", { route: "home", status: 200 }).pipe(
        annotateLogs({ cookie: `template-user.session=${leaked}`, request_id: "abc" }),
      ),
    );
    assert.notInclude(JSON.stringify(logs.stdout), leaked);
    assert.deepStrictEqual(logs.stdout, [
      {
        cookie: "[redacted]",
        event: "http.server.request",
        release: "abc123",
        request_id: "abc",
        route: "home",
        service: "user-server",
        status: 200,
      },
    ]);
  }),
);
