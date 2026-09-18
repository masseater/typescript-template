#!/usr/bin/env node
// oxlint-disable-next-line import/no-nodejs-modules
import { spawn } from "node:child_process";

import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect, Schedule, Schema } from "effect";

import { receiverImage } from "@repo/local/image";

import { exportedTelemetry } from "./exported.ts";
import type { ReceiverOrigins } from "./exported.ts";

class ReceiverCheckFailure extends Schema.TaggedError<ReceiverCheckFailure>()(
  "ReceiverCheckFailure",
  { reason: Schema.String },
) {}

const EVENT = "quality.exported_telemetry";
const commandTimeoutMilliseconds = 120_000;
const readyAttempts = 60;
const exportAttempts = 30;
const attemptDelay = "1 second";
const millisecondsPerNanosecond = 1_000_000;
const windowMinutes = 60;
const traceId = "0123456789abcdef0123456789abcd01";
const spanId = "0123456789abcdef";
const requestId = "11111111-1111-4111-8111-111111111111";
const serviceName = "user-server";
const spanName = "http.server.request";
const publishedPorts = { logs: 3100, otlp: 4318, ready: 13_133, traces: 3200 } as const;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function docker(...args: readonly string[]): Effect.Effect<string, ReceiverCheckFailure> {
  return Effect.callback<string, ReceiverCheckFailure>((resume) => {
    const child = spawn("docker", [...args], { timeout: commandTimeoutMilliseconds });
    const chunks: string[] = [];
    child.stdout.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => {
      chunks.push(chunk);
    });
    child.once("error", (error) => {
      const reason = `docker: ${describe(error)}`;
      resume(Effect.fail(new ReceiverCheckFailure({ reason })));
    });
    child.once("close", (code) => {
      resume(
        code === 0
          ? Effect.succeed(chunks.join("").trim())
          : Effect.fail(
              new ReceiverCheckFailure({ reason: `docker ${args[0] ?? ""} exited ${code}` }),
            ),
      );
    });
  });
}

const started = Effect.fn("started")(function* started(image: string) {
  return yield* docker(
    "run",
    "--detach",
    "--rm",
    "--env",
    "ENABLE_LOGS_OTELCOL=true",
    "--env",
    "GF_AUTH_ANONYMOUS_ENABLED=false",
    ...Object.values(publishedPorts).flatMap((port) => ["--publish", `127.0.0.1:0:${port}`]),
    image,
  );
});

const PortLine = Schema.String.check(Schema.isPattern(/^\d+\/tcp -> 127\.0\.0\.1:\d+$/u));

const publishedOn = Effect.fn("publishedOn")(function* publishedOn(container: string) {
  const listed = yield* docker("port", container);
  const mapped = new Map(
    listed
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => Schema.is(PortLine)(line))
      .map((line) => {
        const [inside, outside] = line.split(" -> ");
        return [Number(inside?.split("/")[0]), Number(outside?.split(":")[1])] as const;
      }),
  );
  const missing = Object.values(publishedPorts).filter((port) => !mapped.has(port));
  if (missing.length > 0) {
    return yield* Effect.fail(
      new ReceiverCheckFailure({ reason: `ports not published: ${missing.join(",")}` }),
    );
  }
  return mapped;
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function fetchText(url: string, init?: RequestInit): Effect.Effect<Response, ReceiverCheckFailure> {
  return Effect.tryPromise({
    catch: (error) => new ReceiverCheckFailure({ reason: `${url}: ${describe(error)}` }),
    try: async (signal) => fetch(url, { ...init, redirect: "manual", signal }),
  }).pipe(
    Effect.filterOrFail(
      (response) => response.ok,
      (response) => new ReceiverCheckFailure({ reason: `${url} answered ${response.status}` }),
    ),
  );
}

const retrying = Schedule.spaced(attemptDelay);

const receiverClock = Effect.fn("receiverClock")(function* receiverClock(origin: string) {
  const response = yield* fetchText(`${origin}/loki/api/v1/labels`);
  const stamp = Date.parse(response.headers.get("date") ?? "");
  return Number.isNaN(stamp) ? Date.now() : stamp;
});

function spanPayload(stamp: number): string {
  const nanos = String(stamp * millisecondsPerNanosecond);
  return JSON.stringify({
    resourceSpans: [
      {
        resource: { attributes: [{ key: "service.name", value: { stringValue: serviceName } }] },
        scopeSpans: [
          {
            spans: [
              {
                endTimeUnixNano: nanos,
                kind: 2,
                name: spanName,
                spanId,
                startTimeUnixNano: nanos,
                traceId,
              },
            ],
          },
        ],
      },
    ],
  });
}

function logPayload(stamp: number): string {
  const nanos = String(stamp * millisecondsPerNanosecond);
  return JSON.stringify({
    resourceLogs: [
      {
        resource: { attributes: [{ key: "service.name", value: { stringValue: serviceName } }] },
        scopeLogs: [
          {
            logRecords: [
              {
                attributes: [{ key: "request_id", value: { stringValue: requestId } }],
                body: { stringValue: spanName },
                observedTimeUnixNano: nanos,
                severityText: "Info",
                spanId,
                timeUnixNano: nanos,
                traceId,
              },
            ],
          },
        ],
      },
    ],
  });
}

const sent = Effect.fn("sent")(function* sent(otlp: string, stamp: number) {
  const headers = { "content-type": "application/json" };
  yield* fetchText(`${otlp}/v1/traces`, { body: spanPayload(stamp), headers, method: "POST" });
  yield* fetchText(`${otlp}/v1/logs`, { body: logPayload(stamp), headers, method: "POST" });
});

const readBack = Effect.fn("readBack")(function* readBack(receiver: ReceiverOrigins) {
  const telemetry = yield* exportedTelemetry(receiver, traceId, windowMinutes).pipe(
    Effect.mapError((failure) => new ReceiverCheckFailure({ reason: failure.reason })),
  );
  const span = telemetry.spans.find((found) => found.traceId === traceId);
  const log = telemetry.logs.find((found) => found.traceId === traceId);
  if (span === undefined || log === undefined) {
    return yield* Effect.fail(new ReceiverCheckFailure({ reason: "receiver returned no match" }));
  }
  return { log, span };
});

type Decoded = Readonly<Effect.Success<ReturnType<typeof readBack>>>;

const assertDecoded = Effect.fn("assertDecoded")(function* assertDecoded(found: Decoded) {
  if (found.span.name !== spanName || found.span.service !== serviceName) {
    return yield* Effect.fail(new ReceiverCheckFailure({ reason: "span decoded unexpectedly" }));
  }
  if (found.log.message !== spanName || found.log.requestId !== requestId) {
    return yield* Effect.fail(new ReceiverCheckFailure({ reason: "log decoded unexpectedly" }));
  }
});

const checked = Effect.fn("checked")(function* checked(container: string) {
  const ports = yield* publishedOn(container);
  function origin(port: number): string {
    return `http://127.0.0.1:${ports.get(port) ?? 0}`;
  }
  yield* fetchText(`${origin(publishedPorts.ready)}/ready`).pipe(
    Effect.retry({ schedule: retrying, times: readyAttempts }),
  );
  const receiver = { logs: origin(publishedPorts.logs), traces: origin(publishedPorts.traces) };
  const stamp = yield* receiverClock(receiver.logs);
  yield* sent(origin(publishedPorts.otlp), stamp);
  yield* readBack(receiver).pipe(
    Effect.retry({ schedule: retrying, times: exportAttempts }),
    Effect.flatMap(assertDecoded),
  );
});

const program = Effect.gen(function* program() {
  const image = yield* receiverImage().pipe(
    Effect.mapError((reason) => new ReceiverCheckFailure({ reason })),
  );
  yield* docker("version", "--format", "{{.Server.Version}}");
  const container = yield* started(image);
  yield* Effect.acquireUseRelease(Effect.succeed(container), checked, (running) =>
    Effect.ignore(docker("rm", "--force", running)),
  );
  return image;
});

NodeRuntime.runMain(
  program.pipe(
    Effect.flatMap((image) => Console.log(JSON.stringify({ event: EVENT, image, ok: true }))),
    Effect.catchTag("ReceiverCheckFailure", (failure) =>
      Console.error(JSON.stringify({ event: EVENT, ok: false, reason: failure.reason })).pipe(
        Effect.andThen(
          Effect.sync(() => {
            process.exitCode = 1;
          }),
        ),
      ),
    ),
  ),
  { disableErrorReporting: true },
);
