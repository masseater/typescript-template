import { setupNetwork } from "@msw/cloudflare";
import { httpStatus } from "@repo/config";
import { Cause, Effect, Ref, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vite-plus/test";

import { annotateSpan, withSpan } from "./annotations.ts";
import { flushTelemetry } from "./otlp.ts";
import { observeRequest } from "./request-span.ts";
import { logAt, logCause } from "./severity.ts";
import { Telemetry } from "./telemetry.ts";

const endpoint = "https://otlp.example.test";
const authorization = "Bearer otlp-test-token";
const leaked = "otlp-test-value-at-least-32-characters-long";
const loggedLine = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

describe("a secret an attribute carries", () => {
  const it = test.extend("attributeSecret", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* attributeSecretProgram() {
        const receivedExports = yield* Ref.make<
          readonly {
            readonly authorization: string | null;
            readonly exported: unknown;
            readonly signal: string | undefined;
          }[]
        >([]);
        const loggedLines = yield* Ref.make<readonly Readonly<Record<string, unknown>>[]>([]);
        const network = setupNetwork();
        network.configure({ onUnhandledFrame: "error" });
        network.use(
          http.post(`${endpoint}/v1/:signal`, ({ params, request }) =>
            Effect.runPromise(
              Effect.gen(function* collectExport() {
                const exported: unknown = yield* Effect.promise(() => request.json());
                yield* Ref.update(receivedExports, (earlier) => [
                  ...earlier,
                  {
                    authorization: request.headers.get("authorization"),
                    exported,
                    signal: typeof params["signal"] === "string" ? params["signal"] : undefined,
                  },
                ]);
                return HttpResponse.json({});
              }),
            ),
          ),
        );
        network.enable();
        onCleanup(() => {
          network.disable();
        });
        const recordLine = (line: string): void => {
          Effect.runSync(
            Ref.update(loggedLines, (earlier) => [
              ...earlier,
              Effect.runSync(Schema.decodeUnknownEffect(loggedLine)(line).pipe(Effect.orDie)),
            ]),
          );
        };
        yield* observeRequest(new Request("http://localhost/"), () =>
          Effect.succeed(new Response(undefined, { status: httpStatus.noContent })),
        ).pipe(
          Effect.tap(() =>
            logAt("Error", {
              attributes: { AUTH_SECRET: leaked, reason: "invalid token" },
              eventName: "authentication.failed",
            }),
          ),
          Effect.tap(() => flushTelemetry),
          Effect.provide(
            Telemetry.layer({
              log: { error: recordLine, info: recordLine, warn: recordLine },
              otlp: { authorization, endpoint },
              release: "abc123",
              routes: { "/": "home" },
              serviceName: "service-member",
            }),
          ),
          Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
          Effect.orDie,
        );
        const loggedRecords = yield* Ref.get(loggedLines);
        const sentExports = yield* Ref.get(receivedExports);
        const exportedLogText = JSON.stringify(
          sentExports.filter((sent) => sent.signal === "logs").map((sent) => sent.exported),
        );
        return {
          exportedEvent: exportedLogText.includes("authentication.failed"),
          exportedLeak: exportedLogText.includes(leaked),
          exportedRedaction: exportedLogText.includes("[redacted]"),
          failureLines: loggedRecords
            .filter((line) => line["event"] === "authentication.failed")
            .map((line) => ({ AUTH_SECRET: line["AUTH_SECRET"], reason: line["reason"] })),
          loggedLeak: JSON.stringify(loggedRecords).includes(leaked),
        };
      }),
    ));

  it("reaches neither the endpoint nor the log line", ({ attributeSecret }) => {
    expect(attributeSecret).toStrictEqual({
      exportedEvent: true,
      exportedLeak: false,
      exportedRedaction: true,
      failureLines: [{ AUTH_SECRET: "[redacted]", reason: "invalid token" }],
      loggedLeak: false,
    });
  });
});

describe("a secret an annotation or a span attribute carries", () => {
  const it = test.extend("annotationSecret", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* annotationSecretProgram() {
        const receivedExports = yield* Ref.make<
          readonly {
            readonly authorization: string | null;
            readonly exported: unknown;
            readonly signal: string | undefined;
          }[]
        >([]);
        const loggedLines = yield* Ref.make<readonly Readonly<Record<string, unknown>>[]>([]);
        const network = setupNetwork();
        network.configure({ onUnhandledFrame: "error" });
        network.use(
          http.post(`${endpoint}/v1/:signal`, ({ params, request }) =>
            Effect.runPromise(
              Effect.gen(function* collectExport() {
                const exported: unknown = yield* Effect.promise(() => request.json());
                yield* Ref.update(receivedExports, (earlier) => [
                  ...earlier,
                  {
                    authorization: request.headers.get("authorization"),
                    exported,
                    signal: typeof params["signal"] === "string" ? params["signal"] : undefined,
                  },
                ]);
                return HttpResponse.json({});
              }),
            ),
          ),
        );
        network.enable();
        onCleanup(() => {
          network.disable();
        });
        const recordLine = (line: string): void => {
          Effect.runSync(
            Ref.update(loggedLines, (earlier) => [
              ...earlier,
              Effect.runSync(Schema.decodeUnknownEffect(loggedLine)(line).pipe(Effect.orDie)),
            ]),
          );
        };
        yield* observeRequest(new Request("http://localhost/"), () =>
          Effect.succeed(new Response(undefined, { status: httpStatus.noContent })),
        ).pipe(
          Effect.tap(() =>
            Effect.andThen(
              annotateSpan({ "session.cookie": `template-user.session=${leaked}` }),
              logAt("Info", {
                attributes: { auth_token: leaked, interview_id: "abc" },
                eventName: "interview.started",
              }),
            ),
          ),
          Effect.tap(() => flushTelemetry),
          Effect.provide(
            Telemetry.layer({
              log: { error: recordLine, info: recordLine, warn: recordLine },
              otlp: { authorization, endpoint },
              release: "abc123",
              routes: { "/": "home" },
              serviceName: "service-member",
            }),
          ),
          Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
          Effect.orDie,
        );
        const loggedRecords = yield* Ref.get(loggedLines);
        const sentExports = yield* Ref.get(receivedExports);
        const exportedLogText = JSON.stringify(
          sentExports.filter((sent) => sent.signal === "logs").map((sent) => sent.exported),
        );
        const exportedTraceText = JSON.stringify(
          sentExports.filter((sent) => sent.signal === "traces").map((sent) => sent.exported),
        );
        return {
          exportedInterviewId: exportedLogText.includes('{"key":"interview_id","value":'),
          exportedLeak: `${exportedLogText}${exportedTraceText}`.includes(leaked),
          exportedRedaction: `${exportedLogText}${exportedTraceText}`.includes("[redacted]"),
          interviewLines: loggedRecords
            .filter((line) => line["event"] === "interview.started")
            .map((line) => ({
              auth_token: line["auth_token"],
              interview_id: line["interview_id"],
            })),
        };
      }),
    ));

  it("reaches no destination", ({ annotationSecret }) => {
    expect(annotationSecret).toStrictEqual({
      exportedInterviewId: true,
      exportedLeak: false,
      exportedRedaction: true,
      interviewLines: [{ auth_token: "[redacted]", interview_id: "abc" }],
    });
  });
});

describe("a secret withSpan attributes carry", () => {
  const it = test.extend("spanSecret", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* spanSecretProgram() {
        const receivedExports = yield* Ref.make<
          readonly {
            readonly authorization: string | null;
            readonly exported: unknown;
            readonly signal: string | undefined;
          }[]
        >([]);
        const loggedLines = yield* Ref.make<readonly Readonly<Record<string, unknown>>[]>([]);
        const network = setupNetwork();
        network.configure({ onUnhandledFrame: "error" });
        network.use(
          http.post(`${endpoint}/v1/:signal`, ({ params, request }) =>
            Effect.runPromise(
              Effect.gen(function* collectExport() {
                const exported: unknown = yield* Effect.promise(() => request.json());
                yield* Ref.update(receivedExports, (earlier) => [
                  ...earlier,
                  {
                    authorization: request.headers.get("authorization"),
                    exported,
                    signal: typeof params["signal"] === "string" ? params["signal"] : undefined,
                  },
                ]);
                return HttpResponse.json({});
              }),
            ),
          ),
        );
        network.enable();
        onCleanup(() => {
          network.disable();
        });
        const recordLine = (line: string): void => {
          Effect.runSync(
            Ref.update(loggedLines, (earlier) => [
              ...earlier,
              Effect.runSync(Schema.decodeUnknownEffect(loggedLine)(line).pipe(Effect.orDie)),
            ]),
          );
        };
        yield* observeRequest(new Request("http://localhost/"), () =>
          Effect.succeed(new Response(undefined, { status: httpStatus.noContent })),
        ).pipe(
          Effect.tap(() =>
            Effect.void.pipe(
              withSpan("interview.complete", {
                attributes: { auth_token: leaked, interview_id: "abc" },
              }),
            ),
          ),
          Effect.tap(() => flushTelemetry),
          Effect.provide(
            Telemetry.layer({
              log: { error: recordLine, info: recordLine, warn: recordLine },
              otlp: { authorization, endpoint },
              release: "abc123",
              routes: { "/": "home" },
              serviceName: "service-member",
            }),
          ),
          Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
          Effect.orDie,
        );
        const sentExports = yield* Ref.get(receivedExports);
        const exportedTraceText = JSON.stringify(
          sentExports.filter((sent) => sent.signal === "traces").map((sent) => sent.exported),
        );
        return {
          exportedInterviewId: exportedTraceText.includes('{"key":"interview_id","value":'),
          exportedLeak: exportedTraceText.includes(leaked),
          exportedRedaction: exportedTraceText.includes("[redacted]"),
        };
      }),
    ));

  it("reaches no destination", ({ spanSecret }) => {
    expect(spanSecret).toStrictEqual({
      exportedInterviewId: true,
      exportedLeak: false,
      exportedRedaction: true,
    });
  });
});

describe("a secret the cause of a failure carries", () => {
  const it = test.extend("causeSecret", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* causeSecretProgram() {
        const receivedExports = yield* Ref.make<
          readonly {
            readonly authorization: string | null;
            readonly exported: unknown;
            readonly signal: string | undefined;
          }[]
        >([]);
        const loggedLines = yield* Ref.make<readonly Readonly<Record<string, unknown>>[]>([]);
        const network = setupNetwork();
        network.configure({ onUnhandledFrame: "error" });
        network.use(
          http.post(`${endpoint}/v1/:signal`, ({ params, request }) =>
            Effect.runPromise(
              Effect.gen(function* collectExport() {
                const exported: unknown = yield* Effect.promise(() => request.json());
                yield* Ref.update(receivedExports, (earlier) => [
                  ...earlier,
                  {
                    authorization: request.headers.get("authorization"),
                    exported,
                    signal: typeof params["signal"] === "string" ? params["signal"] : undefined,
                  },
                ]);
                return HttpResponse.json({});
              }),
            ),
          ),
        );
        network.enable();
        onCleanup(() => {
          network.disable();
        });
        const recordLine = (line: string): void => {
          Effect.runSync(
            Ref.update(loggedLines, (earlier) => [
              ...earlier,
              Effect.runSync(Schema.decodeUnknownEffect(loggedLine)(line).pipe(Effect.orDie)),
            ]),
          );
        };
        yield* observeRequest(new Request("http://localhost/"), () =>
          Effect.succeed(new Response(undefined, { status: httpStatus.noContent })),
        ).pipe(
          Effect.tap(() =>
            logCause({
              cause: Cause.fail(new Error(`no such table: jwks (AUTH_SECRET=${leaked})`)),
              eventName: "application.error",
            }),
          ),
          Effect.tap(() => flushTelemetry),
          Effect.provide(
            Telemetry.layer({
              log: { error: recordLine, info: recordLine, warn: recordLine },
              otlp: { authorization, endpoint },
              release: "abc123",
              routes: { "/": "home" },
              serviceName: "service-member",
            }),
          ),
          Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
          Effect.orDie,
        );
        const sentExports = yield* Ref.get(receivedExports);
        const exportedLogText = JSON.stringify(
          sentExports.filter((sent) => sent.signal === "logs").map((sent) => sent.exported),
        );
        return {
          exportedCause: exportedLogText.includes("no such table: jwks"),
          exportedLeak: exportedLogText.includes(leaked),
          exportedLogErrorKey: exportedLogText.includes('"key":"log.error"'),
        };
      }),
    ));

  it("reaches no destination", ({ causeSecret }) => {
    expect(causeSecret).toStrictEqual({
      exportedCause: true,
      exportedLeak: false,
      exportedLogErrorKey: false,
    });
  });
});
