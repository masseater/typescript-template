import { NodeHttpServer } from "@effect/platform-node";
import { context, metrics, propagation, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { globalErrorHandler } from "@opentelemetry/core";
import { exitWith } from "@repo/cli";
import { ConfigProvider, Console, Context, Effect, Exit, Layer, Ref, Schema, Scope } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, test, vi } from "vite-plus/test";

import type { Telemetry } from "./telemetry.ts";

const MEASURED_SERVICE = "mst-telemetry-under-test";

const SECOND_MEASURED_SERVICE = "mst-telemetry-asked-again";

const MEASURED_TRACER = "telemetry-under-test";

const MEASURED_SPAN = "the work being measured";

const ACCEPTING_COLLECTOR = "accepting";

const REFUSING_COLLECTOR = "refusing";

const COLLECTED_EXPORT = /^\/(?<collector>[a-z]+)\/v1\/(?<signal>[a-z]+)$/u;

const REPORT_PREFIX = "MST_TELEMETRY asked for telemetry, but it could not be exported: ";

const ExportedTraces = Schema.Struct({
  resourceSpans: Schema.Array(
    Schema.Struct({
      resource: Schema.Struct({
        attributes: Schema.Array(
          Schema.Struct({
            key: Schema.String,
            value: Schema.Struct({ stringValue: Schema.optionalKey(Schema.String) }),
          }),
        ),
      }),
      scopeSpans: Schema.Array(
        Schema.Struct({
          scope: Schema.Struct({ name: Schema.String }),
          spans: Schema.Array(Schema.Struct({ name: Schema.String })),
        }),
      ),
    }),
  ),
});

type MeasuredSpan = { readonly service: string | undefined; readonly span: string };

describe("measuredTelemetry", () => {
  const harnessed = test.extend("harness", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* harness() {
        const signals = yield* Ref.make<readonly string[]>([]);
        const spans = yield* Ref.make<readonly MeasuredSpan[]>([]);
        const reports = yield* Ref.make<readonly string[]>([]);
        const services = yield* Effect.context();
        const collectorScope = yield* Scope.make();
        const collector = Context.get(
          yield* Layer.build(NodeHttpServer.layerTest).pipe(Scope.provide(collectorScope)),
          HttpServer.HttpServer,
        );
        yield* collector
          .serve(
            Effect.gen(function* collectExport() {
              const exportRequest = yield* HttpServerRequest.HttpServerRequest;
              const route = COLLECTED_EXPORT.exec(exportRequest.url)?.groups;
              if (exportRequest.method !== "POST" || route?.signal === undefined) {
                return HttpServerResponse.empty({ status: 404 });
              }
              if (route.collector === REFUSING_COLLECTOR) {
                return HttpServerResponse.empty({ status: 400 });
              }
              const { signal } = route;
              yield* Ref.update(signals, (earlier) => [...earlier, signal]);
              if (signal !== "traces") return HttpServerResponse.jsonUnsafe({});
              const exported = yield* Effect.orDie(
                exportRequest.json.pipe(Effect.flatMap(Schema.decodeUnknownEffect(ExportedTraces))),
              );
              const measured = exported.resourceSpans.flatMap((resourceSpans) =>
                resourceSpans.scopeSpans
                  .filter((scopeSpans) => scopeSpans.scope.name === MEASURED_TRACER)
                  .flatMap((scopeSpans) =>
                    scopeSpans.spans.map((span) => ({
                      service: resourceSpans.resource.attributes.find(
                        (attribute) => attribute.key === "service.name",
                      )?.value.stringValue,
                      span: span.name,
                    })),
                  ),
              );
              yield* Ref.update(spans, (earlier) => [...earlier, ...measured]);
              return HttpServerResponse.jsonUnsafe({});
            }),
          )
          .pipe(Scope.provide(collectorScope));
        if (collector.address._tag === "UnixPathAddress") {
          return yield* Effect.die(new Error("the collector did not bind a port"));
        }
        const origin = `http://127.0.0.1:${collector.address.port}`;
        const endpointOf = (collectorName: string): string => `${origin}/${collectorName}`;
        const resetGlobalTelemetry = (): void => {
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          Effect.runSyncWith(services)(exitWith(0));
        };
        resetGlobalTelemetry();
        onCleanup(() =>
          Effect.runPromiseWith(services)(
            Scope.close(collectorScope, Exit.void).pipe(
              Effect.andThen(Effect.sync(resetGlobalTelemetry)),
            ),
          ),
        );
        vi.resetModules();
        const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
        const recordingConsole = {
          ...globalThis.console,
          error: (line: unknown): void => {
            Effect.runSyncWith(services)(
              Ref.update(reports, (earlier) => [...earlier, String(line)]),
            );
          },
        };
        return {
          signals: Ref.get(signals),
          spans: Ref.get(spans),
          spansSoFar: (): readonly MeasuredSpan[] => Effect.runSyncWith(services)(Ref.get(spans)),
          reports: Ref.get(reports),
          endpointOf,
          started: (
            serviceName: string,
            settings: Readonly<Record<string, string>>,
          ): Effect.Effect<Telemetry> =>
            telemetry
              .measuredTelemetry(serviceName)
              .pipe(
                Effect.provideService(
                  ConfigProvider.ConfigProvider,
                  ConfigProvider.fromUnknown(settings),
                ),
                Effect.provideService(Console.Console, recordingConsole),
              ),
        };
      }),
    ));

  describe("an environment that never asked for telemetry", () => {
    const it = harnessed.extend("signalsCollectedWithoutAsking", ({ harness }) =>
      Effect.runPromise(
        Effect.gen(function* notAsked() {
          const started = yield* harness.started(MEASURED_SERVICE, {
            OTEL_EXPORTER_OTLP_ENDPOINT: harness.endpointOf(ACCEPTING_COLLECTOR),
          });
          trace.getTracer(MEASURED_TRACER).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => started.shutdown());
          return yield* harness.signals;
        }),
      ),
    );

    it("sends the collector nothing at all", ({ signalsCollectedWithoutAsking }) => {
      expect(signalsCollectedWithoutAsking).toStrictEqual([]);
    });
  });

  describe("an environment that asked for telemetry but disabled the sdk", () => {
    const it = harnessed.extend("signalsCollectedWithADisabledSdk", ({ harness }) =>
      Effect.runPromise(
        Effect.gen(function* disabled() {
          const started = yield* harness.started(MEASURED_SERVICE, {
            MST_TELEMETRY: "1",
            OTEL_SDK_DISABLED: "true",
            OTEL_EXPORTER_OTLP_ENDPOINT: harness.endpointOf(ACCEPTING_COLLECTOR),
          });
          trace.getTracer(MEASURED_TRACER).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => started.shutdown());
          return yield* harness.signals;
        }),
      ),
    );

    it("sends the collector nothing even though it was asked", ({
      signalsCollectedWithADisabledSdk,
    }) => {
      expect(signalsCollectedWithADisabledSdk).toStrictEqual([]);
    });
  });

  describe("an environment that asked for telemetry", () => {
    const it = harnessed.extend("spansCollectedAfterAsking", ({ harness }, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* asked() {
          const started = yield* harness.started(MEASURED_SERVICE, {
            MST_TELEMETRY: "1",
            OTEL_EXPORTER_OTLP_ENDPOINT: `${harness.endpointOf(ACCEPTING_COLLECTOR)}/`,
          });
          onCleanup(() => started.shutdown());
          trace.getTracer(MEASURED_TRACER).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => vi.waitUntil(() => harness.spansSoFar().length > 0));
          return yield* harness.spans;
        }),
      ),
    );

    it("sends the collector what was recorded under it once the process winds down", ({
      spansCollectedAfterAsking,
    }) => {
      expect(spansCollectedAfterAsking).toStrictEqual([
        { service: MEASURED_SERVICE, span: MEASURED_SPAN },
      ]);
    });
  });

  describe("an environment that asked for telemetry without naming a collector", () => {
    const it = harnessed.extend("telemetryStartedWithoutACollector", ({ harness }, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* noCollector() {
          const started = yield* harness.started(MEASURED_SERVICE, { MST_TELEMETRY: "1" });
          onCleanup(() => started.shutdown());
          return started.enabled;
        }),
      ),
    );

    it("still measures and leaves the destination to the exporters", ({
      telemetryStartedWithoutACollector,
    }) => {
      expect(telemetryStartedWithoutACollector).toBe(true);
    });
  });

  describe("a second entry asking for telemetry that already started", () => {
    const it = harnessed.extend("spansCollectedAfterTheSecondEntry", ({ harness }) =>
      Effect.runPromise(
        Effect.gen(function* askedTwice() {
          const settings = {
            MST_TELEMETRY: "1",
            OTEL_EXPORTER_OTLP_ENDPOINT: harness.endpointOf(ACCEPTING_COLLECTOR),
          };
          const started = yield* harness.started(MEASURED_SERVICE, settings);
          yield* harness.started(SECOND_MEASURED_SERVICE, settings);
          trace.getTracer(MEASURED_TRACER).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          yield* Effect.promise(() => started.shutdown());
          return yield* harness.spans;
        }),
      ),
    );

    it("keeps the service the first entry named", ({ spansCollectedAfterTheSecondEntry }) => {
      expect(spansCollectedAfterTheSecondEntry).toStrictEqual([
        { service: MEASURED_SERVICE, span: MEASURED_SPAN },
      ]);
    });
  });

  describe("a process winding down after every signal was recorded", () => {
    const it = harnessed.extend("signalsCollectedOnShutdown", ({ harness }) =>
      Effect.runPromise(
        Effect.gen(function* everySignal() {
          const started = yield* harness.started(MEASURED_SERVICE, {
            MST_TELEMETRY: "1",
            OTEL_EXPORTER_OTLP_ENDPOINT: harness.endpointOf(ACCEPTING_COLLECTOR),
          });
          trace.getTracer(MEASURED_TRACER).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          metrics.getMeter(MEASURED_TRACER).createCounter("measured.runs").add(1);
          logs.getLogger(MEASURED_TRACER).emit({ body: MEASURED_SPAN });
          yield* Effect.promise(() => started.shutdown());
          const signals = yield* harness.signals;
          return signals.toSorted((left, right) => left.localeCompare(right));
        }),
      ),
    );

    it("flushes every exporter it started", ({ signalsCollectedOnShutdown }) => {
      expect(signalsCollectedOnShutdown).toStrictEqual(["logs", "metrics", "traces"]);
    });
  });

  describe("a signal given an endpoint of its own", () => {
    const it = harnessed.extend("spansCollectedAtTheirOwnEndpoint", ({ harness }) =>
      Effect.runPromise(
        Effect.gen(function* ownEndpoint() {
          const started = yield* harness.started(MEASURED_SERVICE, {
            MST_TELEMETRY: "1",
            OTEL_EXPORTER_OTLP_ENDPOINT: harness.endpointOf(REFUSING_COLLECTOR),
            OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: `${harness.endpointOf(ACCEPTING_COLLECTOR)}/v1/traces`,
          });
          trace.getTracer(MEASURED_TRACER).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          yield* Effect.promise(() => started.shutdown());
          return yield* harness.spans;
        }),
      ),
    );

    it("sends that signal there instead of the shared endpoint", ({
      spansCollectedAtTheirOwnEndpoint,
    }) => {
      expect(spansCollectedAtTheirOwnEndpoint).toStrictEqual([
        { service: MEASURED_SERVICE, span: MEASURED_SPAN },
      ]);
    });
  });

  describe("a shutdown the collector refuses", () => {
    const it = harnessed.extend("reportsOfARefusedShutdown", ({ harness }) =>
      Effect.runPromise(
        Effect.gen(function* refused() {
          const started = yield* harness.started(MEASURED_SERVICE, {
            MST_TELEMETRY: "1",
            OTEL_EXPORTER_OTLP_ENDPOINT: harness.endpointOf(REFUSING_COLLECTOR),
          });
          trace.getTracer(MEASURED_TRACER).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          yield* Effect.promise(() => started.shutdown());
          return yield* harness.reports;
        }),
      ),
    );

    it("reports the refusal instead of leaving the rejection unhandled", ({
      reportsOfARefusedShutdown,
    }) => {
      expect(reportsOfARefusedShutdown).toStrictEqual([`${REPORT_PREFIX}Bad Request`]);
    });
  });

  describe("an export failure carrying a value that is not an error", () => {
    const it = harnessed.extend("reportsOfAThrownValue", ({ harness }, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* thrownValue() {
          const started = yield* harness.started(MEASURED_SERVICE, {
            MST_TELEMETRY: "1",
            OTEL_EXPORTER_OTLP_ENDPOINT: harness.endpointOf(ACCEPTING_COLLECTOR),
          });
          onCleanup(() => started.shutdown());
          globalErrorHandler({ code: "503" });
          return yield* harness.reports;
        }),
      ),
    );

    it("reports the value that was thrown", ({ reportsOfAThrownValue }) => {
      expect(reportsOfAThrownValue).toStrictEqual([`${REPORT_PREFIX}{"code":"503"}`]);
    });
  });

  describe("an export failure carrying an error", () => {
    const it = harnessed.extend("reportsOfAThrownError", ({ harness }, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* thrownError() {
          const started = yield* harness.started(MEASURED_SERVICE, {
            MST_TELEMETRY: "1",
            OTEL_EXPORTER_OTLP_ENDPOINT: harness.endpointOf(ACCEPTING_COLLECTOR),
          });
          onCleanup(() => started.shutdown());
          globalErrorHandler(new Error("the collector refused"));
          return yield* harness.reports;
        }),
      ),
    );

    it("reports the message the error carried", ({ reportsOfAThrownError }) => {
      expect(reportsOfAThrownError).toStrictEqual([`${REPORT_PREFIX}the collector refused`]);
    });
  });
});
