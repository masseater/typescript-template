import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { annotateLogs } from "./annotations.ts";
import { Telemetry } from "./telemetry.ts";
import { recordedLogs } from "./testing.ts";

const leaked = "structured-log-test-value-at-least-32-characters";

describe.for([
  [
    "an authentication failure that carries a secret in its attributes",
    Effect.logError("authentication.failed", {
      cause: {
        AUTH_SECRET: leaked,
        headers: `authorization: Bearer ${leaked}`,
        reason: "invalid token",
      },
    }),
    {
      stderr: [
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
      ],
      stdout: [],
      stdwarn: [],
    },
  ],
  [
    "an error that broke the model and carries a secret",
    Effect.logWarning("interview.model_failed", {
      cause: new Error(`D1_ERROR: no such table: jwks (AUTH_SECRET=${leaked})`),
      reason: "model_failed",
    }),
    {
      stderr: [],
      stdout: [],
      stdwarn: [
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
      ],
    },
  ],
  [
    "an annotation that carries a secret beside the attributes of the call",
    Effect.logInfo("http.server.request", { route: "home", status: 200 }).pipe(
      annotateLogs({ cookie: `template-user.session=${leaked}`, request_id: "abc" }),
    ),
    {
      stderr: [],
      stdout: [
        {
          cookie: "[redacted]",
          event: "http.server.request",
          release: "abc123",
          request_id: "abc",
          route: "home",
          service: "user-server",
          status: 200,
        },
      ],
      stdwarn: [],
    },
  ],
] as const)("%s", ([, logged, expectedLines]) => {
  const it = test.extend("reportedLogs", async () =>
    recordedLogs((sink) =>
      logged.pipe(
        Effect.provide(
          Telemetry.layer({
            log: sink,
            release: "abc123",
            routes: { "/": "home" },
            serviceName: "user",
          }),
        ),
      ),
    ));

  it("is written with the secret hidden", ({ reportedLogs }) => {
    expect(reportedLogs).toStrictEqual(expectedLines);
  });
});
