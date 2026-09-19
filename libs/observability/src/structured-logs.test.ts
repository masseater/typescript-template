import { assert, it } from "@effect/vitest";
import { Cause, Effect } from "effect";

import { annotateLogs } from "./annotations.ts";
import { logAt, logCause } from "./severity.ts";
import { Telemetry } from "./telemetry.ts";
import { recordingSink } from "./testing.ts";

const leaked = "structured-log-test-value-at-least-32-characters";

const recorded = function recorded(
  program: Effect.Effect<void>,
): Effect.Effect<ReturnType<typeof recordingSink>> {
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
};

it.effect("hides a secret an authentication failure puts in its attributes", () =>
  Effect.gen(function* program() {
    const logs = yield* recorded(
      logAt("Error", {
        attributes: {
          AUTH_SECRET: leaked,
          headers: `authorization: Bearer ${leaked}`,
          reason: "invalid token",
        },
        eventName: "authentication.failed",
      }),
    );
    assert.notInclude(JSON.stringify(logs.stderr), leaked);
    assert.deepStrictEqual(logs.stderr, [
      {
        AUTH_SECRET: "[redacted]",
        event: "authentication.failed",
        headers: "authorization: [redacted]",
        reason: "invalid token",
        release: "abc123",
        service: "user-server",
      },
    ]);
  }),
);

it.effect("keeps the error that broke the model readable while hiding the secret it carries", () =>
  Effect.gen(function* program() {
    const logs = yield* recorded(
      logAt("Warn", {
        attributes: {
          cause: `D1_ERROR: no such table: jwks (AUTH_SECRET=${leaked})`,
          reason: "model_failed",
        },
        eventName: "interview.model_failed",
      }),
    );
    assert.notInclude(JSON.stringify(logs.stdwarn), leaked);
    assert.deepStrictEqual(logs.stdwarn, [
      {
        cause: "D1_ERROR: no such table: jwks (AUTH_SECRET=[redacted])",
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
      logAt("Info", {
        attributes: { route: "home", status: 200 },
        eventName: "http.server.request",
      }).pipe(annotateLogs({ cookie: `template-user.session=${leaked}`, request_id: "abc" })),
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

const brokenTable = Cause.fail(new Error(`no such table: jwks (AUTH_SECRET=${leaked})`));

it.effect("keeps the cause of a failure in the line, minus the secret it carries", () =>
  Effect.gen(function* program() {
    const logs = yield* recorded(logCause({ cause: brokenTable, eventName: "application.error" }));
    const [line] = logs.stderr;
    const reported = JSON.stringify(line);
    assert.notInclude(reported, leaked);
    assert.include(reported, "no such table: jwks");
    assert.include(reported, "error.cause");
  }),
);
