import { setupNetwork } from "@msw/cloudflare";
import { httpStatus } from "@repo/config";
import { Effect, Redacted, Ref, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vite-plus/test";

import { flushTelemetry } from "./otlp.ts";
import { observeRequest } from "./request-span.ts";
import { logAt } from "./severity.ts";
import { Telemetry } from "./telemetry.ts";

const endpoint = "https://otlp.example.test";
const authorization = "Bearer otlp-test-token";
const rejected = 404;
const exportedTraceIds = /"traceId":"(?<traceId>[0-9a-f]{32})"/gu;
const traceparentTraceId = /^00-(?<traceId>[0-9a-f]{32})-[0-9a-f]{16}-01$/u;
const traceIdPattern = /^[0-9a-f]{32}$/u;
const loggedLine = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));
const jsonText = Schema.fromJsonString(Schema.Unknown);

describe("an exported request", () => {
  const it = test.extend("sharedTrace", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* sharedTraceProgram() {
        const receivedExports = yield* Ref.make<
          readonly {
            readonly authorization: string | null;
            readonly exported: unknown;
            readonly signal: string | undefined;
          }[]
        >([]);
        const loggedLines = yield* Ref.make<readonly Readonly<Record<string, unknown>>[]>([]);
        const services = yield* Effect.context();
        const network = setupNetwork();
        network.configure({ onUnhandledFrame: "error" });
        network.use(
          http.post(`${endpoint}/v1/:signal`, ({ params, request }) =>
            Effect.runPromiseWith(services)(
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
          Effect.runSyncWith(services)(
            Schema.decodeEffect(loggedLine)(line).pipe(
              Effect.orDie,
              Effect.flatMap((decoded) =>
                Ref.update(loggedLines, (earlier) => [...earlier, decoded]),
              ),
            ),
          );
        };
        const answered = yield* observeRequest(new Request("http://localhost/"), () =>
          Effect.succeed(new Response(undefined, { status: httpStatus.noContent })),
        ).pipe(
          Effect.tap(() => Effect.void),
          Effect.tap(() => flushTelemetry),
          Effect.provide(
            Telemetry.layer({
              log: { error: recordLine, info: recordLine, warn: recordLine },
              otlp: { authorization: Redacted.make(authorization), endpoint },
              release: "abc123",
              routes: { "/": "home" },
              serviceName: "service-member",
            }),
          ),
          Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
          Effect.orDie,
        );
        const responseTraceId =
          traceparentTraceId.exec(answered.headers.get("traceparent") ?? "")?.groups?.["traceId"] ??
          "";
        const loggedRecords = yield* Ref.get(loggedLines);
        const sentExports = yield* Ref.get(receivedExports);
        const exportedLogText = yield* Schema.encodeEffect(jsonText)(
          sentExports.filter((sent) => sent.signal === "logs").map((sent) => sent.exported),
        );
        const exportedTraceText = yield* Schema.encodeEffect(jsonText)(
          sentExports.filter((sent) => sent.signal === "traces").map((sent) => sent.exported),
        );
        return {
          authorizations: [...new Set(sentExports.map((sent) => sent.authorization))],
          exportedLogAttributes: ["duration_ms", "request_id", "route", "status"].filter(
            (attributeKey) => exportedLogText.includes(`{"key":"${attributeKey}","value":`),
          ),
          exportedLogBodyNamesTheRequest: exportedLogText.includes(
            '"body":{"stringValue":"http.server.request"}',
          ),
          logTraceIds: Array.from(exportedLogText.matchAll(exportedTraceIds), (traceMatch) =>
            traceMatch.groups?.["traceId"] === responseTraceId ? "response" : traceMatch[0],
          ),
          requestLines: loggedRecords
            .filter((line) => line["event"] === "http.server.request")
            .map((line) => ({
              onResponseTrace: line["trace_id"] === responseTraceId,
              service: line["service"],
            })),
          responseTraceIdWellFormed: traceIdPattern.test(responseTraceId),
          spanTraceIds: Array.from(exportedTraceText.matchAll(exportedTraceIds), (traceMatch) =>
            traceMatch.groups?.["traceId"] === responseTraceId ? "response" : traceMatch[0],
          ),
        };
      }),
    ));

  it("shares one trace id across spans, logs and the response at the OTLP endpoint", ({
    sharedTrace,
  }) => {
    expect(sharedTrace).toStrictEqual({
      authorizations: [authorization],
      exportedLogAttributes: ["duration_ms", "request_id", "route", "status"],
      exportedLogBodyNamesTheRequest: true,
      logTraceIds: ["response"],
      requestLines: [{ onResponseTrace: true, service: "service-member-server" }],
      responseTraceIdWellFormed: true,
      spanTraceIds: ["response"],
    });
  });
});

describe("a request without an OTLP destination", () => {
  const it = test.extend("structuredOnly", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* structuredOnlyProgram() {
        const receivedExports = yield* Ref.make<
          readonly {
            readonly authorization: string | null;
            readonly exported: unknown;
            readonly signal: string | undefined;
          }[]
        >([]);
        const loggedLines = yield* Ref.make<readonly Readonly<Record<string, unknown>>[]>([]);
        const services = yield* Effect.context();
        const network = setupNetwork();
        network.configure({ onUnhandledFrame: "error" });
        network.use(
          http.post(`${endpoint}/v1/:signal`, ({ params, request }) =>
            Effect.runPromiseWith(services)(
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
          Effect.runSyncWith(services)(
            Schema.decodeEffect(loggedLine)(line).pipe(
              Effect.orDie,
              Effect.flatMap((decoded) =>
                Ref.update(loggedLines, (earlier) => [...earlier, decoded]),
              ),
            ),
          );
        };
        const answered = yield* observeRequest(new Request("http://localhost/"), () =>
          Effect.succeed(new Response(undefined, { status: httpStatus.noContent })),
        ).pipe(
          Effect.tap(() => Effect.void),
          Effect.tap(() => flushTelemetry),
          Effect.provide(
            Telemetry.layer({
              log: { error: recordLine, info: recordLine, warn: recordLine },
              otlp: undefined,
              release: "abc123",
              routes: { "/": "home" },
              serviceName: "service-member",
            }),
          ),
          Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
          Effect.orDie,
        );
        const responseTraceId =
          traceparentTraceId.exec(answered.headers.get("traceparent") ?? "")?.groups?.["traceId"] ??
          "";
        const loggedRecords = yield* Ref.get(loggedLines);
        const sentExports = yield* Ref.get(receivedExports);
        const exportedLogText = yield* Schema.encodeEffect(jsonText)(
          sentExports.filter((sent) => sent.signal === "logs").map((sent) => sent.exported),
        );
        const exportedTraceText = yield* Schema.encodeEffect(jsonText)(
          sentExports.filter((sent) => sent.signal === "traces").map((sent) => sent.exported),
        );
        return {
          exportedBatches: sentExports.length,
          requestLinesOnResponseTrace: loggedRecords
            .filter((line) => line["event"] === "http.server.request")
            .map((line) => line["trace_id"] === responseTraceId),
          textExported: [exportedLogText, exportedTraceText],
        };
      }),
    ));

  it("leaves the structured log line as the only record", ({ structuredOnly }) => {
    expect(structuredOnly).toStrictEqual({
      exportedBatches: 0,
      requestLinesOnResponseTrace: [true],
      textExported: ["[]", "[]"],
    });
  });
});

describe("client requests refused with client errors", () => {
  const it = test.extend("exportedSeverities", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* exportedSeveritiesProgram() {
        const receivedExports = yield* Ref.make<
          readonly {
            readonly authorization: string | null;
            readonly exported: unknown;
            readonly signal: string | undefined;
          }[]
        >([]);
        const loggedLines = yield* Ref.make<readonly Readonly<Record<string, unknown>>[]>([]);
        const services = yield* Effect.context();
        const network = setupNetwork();
        network.configure({ onUnhandledFrame: "error" });
        network.use(
          http.post(`${endpoint}/v1/:signal`, ({ params, request }) =>
            Effect.runPromiseWith(services)(
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
          Effect.runSyncWith(services)(
            Schema.decodeEffect(loggedLine)(line).pipe(
              Effect.orDie,
              Effect.flatMap((decoded) =>
                Ref.update(loggedLines, (earlier) => [...earlier, decoded]),
              ),
            ),
          );
        };
        yield* observeRequest(new Request("http://localhost/"), () =>
          Effect.succeed(new Response(undefined, { status: httpStatus.noContent })),
        ).pipe(
          Effect.tap(() =>
            Effect.andThen(
              logAt("Info", {
                attributes: { "http.response.status_code": httpStatus.forbidden },
                eventName: "http.client.request",
              }),
              logAt("Warn", {
                attributes: { "http.response.status_code": httpStatus.badRequest },
                eventName: "http.client.request",
              }),
            ),
          ),
          Effect.tap(() => flushTelemetry),
          Effect.provide(
            Telemetry.layer({
              log: { error: recordLine, info: recordLine, warn: recordLine },
              otlp: { authorization: Redacted.make(authorization), endpoint },
              release: "abc123",
              routes: { "/": "home" },
              serviceName: "service-member",
            }),
          ),
          Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
          Effect.orDie,
        );
        const sentExports = yield* Ref.get(receivedExports);
        const exportedLogText = yield* Schema.encodeEffect(jsonText)(
          sentExports.filter((sent) => sent.signal === "logs").map((sent) => sent.exported),
        );
        return [
          ...new Set(
            Array.from(
              exportedLogText.matchAll(/"severityText":"(?<severity>[A-Za-z]+)"/gu),
              (severityMatch) => severityMatch.groups?.["severity"],
            ),
          ),
        ].toSorted((left, right) => (left ?? "").localeCompare(right ?? ""));
      }),
    ));

  it("reach the endpoint with the severity the status code asks for", ({ exportedSeverities }) => {
    expect(exportedSeverities).toStrictEqual(["Info", "Warn"]);
  });
});

describe("a receiver that rejects the export", () => {
  const it = test.extend("rejectedExport", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* rejectedExportProgram() {
        const receivedExports = yield* Ref.make<
          readonly {
            readonly authorization: string | null;
            readonly exported: unknown;
            readonly signal: string | undefined;
          }[]
        >([]);
        const loggedLines = yield* Ref.make<readonly Readonly<Record<string, unknown>>[]>([]);
        const services = yield* Effect.context();
        const network = setupNetwork();
        network.configure({ onUnhandledFrame: "error" });
        network.use(
          http.post(`${endpoint}/v1/:signal`, ({ params, request }) =>
            Effect.runPromiseWith(services)(
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
                return new HttpResponse(undefined, { status: rejected });
              }),
            ),
          ),
        );
        network.enable();
        onCleanup(() => {
          network.disable();
        });
        const recordLine = (line: string): void => {
          Effect.runSyncWith(services)(
            Schema.decodeEffect(loggedLine)(line).pipe(
              Effect.orDie,
              Effect.flatMap((decoded) =>
                Ref.update(loggedLines, (earlier) => [...earlier, decoded]),
              ),
            ),
          );
        };
        yield* observeRequest(new Request("http://localhost/"), () =>
          Effect.succeed(new Response(undefined, { status: httpStatus.noContent })),
        ).pipe(
          Effect.tap(() => Effect.void),
          Effect.tap(() => flushTelemetry),
          Effect.provide(
            Telemetry.layer({
              log: { error: recordLine, info: recordLine, warn: recordLine },
              otlp: { endpoint },
              release: "abc123",
              routes: { "/": "home" },
              serviceName: "service-member",
            }),
          ),
          Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch),
          Effect.orDie,
        );
        const loggedRecords = yield* Ref.get(loggedLines);
        return [
          ...new Set(
            loggedRecords
              .filter((line) => line["event"] === "otlp.export_failed")
              .map((line) => line["otlp.status"]),
          ),
        ];
      }),
    ));

  it("leaves a warning in the structured log", ({ rejectedExport }) => {
    expect(rejectedExport).toStrictEqual([rejected]);
  });
});
