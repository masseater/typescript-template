import { Telemetry } from "@repo/observability";
import { Effect, Ref } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { createLogger } from "./auth-logger.ts";

type Line = { readonly line: unknown; readonly stream: "error" | "info" | "warn" };

const loggedBy = (
  write: (logger: ReturnType<typeof createLogger>) => void,
): Promise<readonly Line[]> => {
  const lines = Ref.makeUnsafe<readonly Line[]>([]);
  const recordInto =
    (stream: Line["stream"]) =>
    (line: string): void => {
      const parsedLine: unknown = JSON.parse(line);
      Effect.runSync(Ref.update(lines, (earlier) => [...earlier, { line: parsedLine, stream }]));
    };
  const layer = Telemetry.layer({
    log: { error: recordInto("error"), info: recordInto("info"), warn: recordInto("warn") },
    release: "abc123",
    routes: { "/": "home" },
    serviceName: "service-member",
  });
  const pending: Promise<void>[] = [];
  write(
    createLogger((logged) => {
      const written = Effect.runPromise(logged.pipe(Effect.provide(layer)));
      pending.push(written);
      return written;
    }),
  );
  return Promise.all(pending).then(() => Effect.runSync(Ref.get(lines)));
};

describe("a failure better-auth reports with its description and details", () => {
  const it = test.extend("lines", () =>
    loggedBy((logger) => {
      const relayFailure: unknown = Object.create(TypeError.prototype, {
        message: { value: "member@example.test rejected" },
        stack: { value: "TypeError: member@example.test rejected\n    at relay" },
      });
      logger.log?.(
        "error",
        "Failed to send the email to member@example.test",
        { userId: "u1", clientIp: "192.0.2.10" },
        Object.create(Error.prototype, {
          cause: { value: relayFailure },
          message: { value: "mail relay refused" },
          stack: { value: "Error: mail relay refused\n    at sendMail" },
        }),
      );
    }));

  it("keeps the description, the details and the chain of causes, minus the personal values", ({
    lines,
  }) => {
    expect(lines).toStrictEqual([
      {
        line: {
          description: "Failed to send the email to [redacted]",
          details: JSON.stringify([{ userId: "u1", clientIp: "[redacted]" }]),
          "error.cause": [
            "Error: mail relay refused",
            "    at sendMail {",
            "  [cause]: TypeError: [redacted] rejected",
            "      at relay",
            "}",
          ].join("\n"),
          event: "authentication.failed",
          level: "error",
          release: "abc123",
          service: "service-member-server",
        },
        stream: "error",
      },
    ]);
  });
});
