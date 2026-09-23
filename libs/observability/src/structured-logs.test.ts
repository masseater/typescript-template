import { Cause, Effect, Ref } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { annotateLogs } from "./annotations.ts";
import { logAt, logCause } from "./severity.ts";
import { Telemetry } from "./telemetry.ts";

import type { LogSink } from "./structured-logs.ts";

const leaked = "structured-log-test-value-at-least-32-characters";
const telemetrySettings = {
  release: "abc123",
  routes: { "/": "home" },
  serviceName: "service-member",
} as const;

describe("an authentication failure carrying a secret in its attributes", () => {
  const it = test.extend("loggedLines", async () => {
    const loggedLines = Ref.makeUnsafe<
      readonly { readonly line: unknown; readonly stream: keyof LogSink }[]
    >([]);
    const recordInto =
      (stream: keyof LogSink) =>
      (line: string): void => {
        const parsedLine: unknown = JSON.parse(line);
        Effect.runSync(
          Ref.update(loggedLines, (earlier) => [...earlier, { line: parsedLine, stream }]),
        );
      };
    const logSink = {
      error: recordInto("error"),
      info: recordInto("info"),
      warn: recordInto("warn"),
    };
    await Effect.runPromise(
      logAt("Error", {
        attributes: {
          AUTH_SECRET: leaked,
          headers: `authorization: Bearer ${leaked}`,
          reason: "invalid token",
        },
        eventName: "authentication.failed",
      }).pipe(Effect.provide(Telemetry.layer({ ...telemetrySettings, log: logSink }))),
    );
    return Ref.getUnsafe(loggedLines);
  });

  it("is logged with the secret hidden", ({ loggedLines }) => {
    expect(loggedLines).toStrictEqual([
      {
        line: {
          AUTH_SECRET: "[redacted]",
          event: "authentication.failed",
          headers: "authorization: [redacted]",
          reason: "invalid token",
          release: "abc123",
          service: "service-member-server",
        },
        stream: "error",
      },
    ]);
  });
});

describe("a model failure whose error carries a secret", () => {
  const it = test.extend("loggedLines", async () => {
    const loggedLines = Ref.makeUnsafe<
      readonly { readonly line: unknown; readonly stream: keyof LogSink }[]
    >([]);
    const recordInto =
      (stream: keyof LogSink) =>
      (line: string): void => {
        const parsedLine: unknown = JSON.parse(line);
        Effect.runSync(
          Ref.update(loggedLines, (earlier) => [...earlier, { line: parsedLine, stream }]),
        );
      };
    const logSink = {
      error: recordInto("error"),
      info: recordInto("info"),
      warn: recordInto("warn"),
    };
    await Effect.runPromise(
      logAt("Warn", {
        attributes: {
          cause: `D1_ERROR: no such table: jwks (AUTH_SECRET=${leaked})`,
          reason: "model_failed",
        },
        eventName: "interview.model_failed",
      }).pipe(Effect.provide(Telemetry.layer({ ...telemetrySettings, log: logSink }))),
    );
    return Ref.getUnsafe(loggedLines);
  });

  it("keeps the error readable while hiding the secret", ({ loggedLines }) => {
    expect(loggedLines).toStrictEqual([
      {
        line: {
          cause: "D1_ERROR: no such table: jwks (AUTH_SECRET=[redacted])",
          event: "interview.model_failed",
          reason: "model_failed",
          release: "abc123",
          service: "service-member-server",
        },
        stream: "warn",
      },
    ]);
  });
});

describe("an annotation carrying a secret", () => {
  const it = test.extend("loggedLines", async () => {
    const loggedLines = Ref.makeUnsafe<
      readonly { readonly line: unknown; readonly stream: keyof LogSink }[]
    >([]);
    const recordInto =
      (stream: keyof LogSink) =>
      (line: string): void => {
        const parsedLine: unknown = JSON.parse(line);
        Effect.runSync(
          Ref.update(loggedLines, (earlier) => [...earlier, { line: parsedLine, stream }]),
        );
      };
    const logSink = {
      error: recordInto("error"),
      info: recordInto("info"),
      warn: recordInto("warn"),
    };
    await Effect.runPromise(
      logAt("Info", {
        attributes: { route: "home", status: 200 },
        eventName: "http.server.request",
      }).pipe(
        annotateLogs({ cookie: `template-user.session=${leaked}`, request_id: "abc" }),
        Effect.provide(Telemetry.layer({ ...telemetrySettings, log: logSink })),
      ),
    );
    return Ref.getUnsafe(loggedLines);
  });

  it("is hidden as well as the attributes of the call", ({ loggedLines }) => {
    expect(loggedLines).toStrictEqual([
      {
        line: {
          cookie: "[redacted]",
          event: "http.server.request",
          release: "abc123",
          request_id: "abc",
          route: "home",
          service: "service-member-server",
          status: 200,
        },
        stream: "info",
      },
    ]);
  });
});

describe("a failure whose cause carries a secret", () => {
  const it = test.extend("loggedLines", async () => {
    const loggedLines = Ref.makeUnsafe<
      readonly { readonly line: unknown; readonly stream: keyof LogSink }[]
    >([]);
    const recordInto =
      (stream: keyof LogSink) =>
      (line: string): void => {
        const parsedLine: unknown = JSON.parse(line);
        Effect.runSync(
          Ref.update(loggedLines, (earlier) => [...earlier, { line: parsedLine, stream }]),
        );
      };
    const logSink = {
      error: recordInto("error"),
      info: recordInto("info"),
      warn: recordInto("warn"),
    };
    class BrokenTable extends Error {
      public override readonly stack = `Error: no such table: jwks (AUTH_SECRET=${leaked})\n    at readJwks`;
    }
    const brokenTable = new BrokenTable(`no such table: jwks (AUTH_SECRET=${leaked})`);
    await Effect.runPromise(
      logCause({ cause: Cause.fail(brokenTable), eventName: "application.error" }).pipe(
        Effect.provide(Telemetry.layer({ ...telemetrySettings, log: logSink })),
      ),
    );
    return Ref.getUnsafe(loggedLines);
  });

  it("keeps the cause in the line minus the secret", ({ loggedLines }) => {
    expect(loggedLines).toStrictEqual([
      {
        line: {
          "error.cause": "Error: no such table: jwks (AUTH_SECRET=[redacted])\n    at readJwks",
          event: "application.error",
          release: "abc123",
          service: "service-member-server",
        },
        stream: "error",
      },
    ]);
  });
});
