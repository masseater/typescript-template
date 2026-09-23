import { SpanStatusCode, context, metrics, propagation, trace } from "@opentelemetry/api";
import { Effect } from "effect";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

const INSTRUMENTATION_NAME = "@repo/dont-review-it/repository-checks";

const forgetTelemetry = (): void => {
  process.exitCode = undefined;
  process.removeAllListeners("beforeExit");
  context.disable();
  metrics.disable();
  propagation.disable();
  trace.disable();
};

describe("measureCheck", () => {
  describe("a check measured in an environment that never asked for telemetry", () => {
    describe("what the measured check produced", () => {
      const it = test.extend("checkProductWithoutTelemetry", () =>
        Effect.runPromise(
          Effect.gen(function* checkProductWithoutTelemetry() {
            vi.stubEnv("MST_TELEMETRY", undefined);
            vi.stubEnv("OTEL_SDK_DISABLED", undefined);
            onTestFinished(forgetTelemetry);
            vi.resetModules();
            const telemetry = yield* Effect.promise(() => import("./check-telemetry.ts"));
            return yield* Effect.promise(() => telemetry.measureCheck(() => 41 + 1));
          }),
        ));

      it("comes back to whoever measured it", ({ checkProductWithoutTelemetry }) => {
        expect(checkProductWithoutTelemetry).toBe(42);
      });
    });

    describe("the span the check ran under", () => {
      const it = test.extend("spanWithoutTelemetry", () =>
        Effect.runPromise(
          Effect.gen(function* spanWithoutTelemetry() {
            vi.stubEnv("MST_TELEMETRY", undefined);
            vi.stubEnv("OTEL_SDK_DISABLED", undefined);
            onTestFinished(forgetTelemetry);
            vi.resetModules();
            const telemetry = yield* Effect.promise(() => import("./check-telemetry.ts"));
            return yield* Effect.promise(() =>
              telemetry.measureCheck(() => trace.getSpan(context.active())),
            );
          }),
        ));

      it("was never opened", ({ spanWithoutTelemetry }) => {
        expect(spanWithoutTelemetry).toBe(undefined);
      });
    });
  });

  describe("a check measured in an environment that asked for telemetry", () => {
    describe("what the measured check produced", () => {
      const it = test.extend("checkProductWithTelemetry", () =>
        Effect.runPromise(
          Effect.gen(function* checkProductWithTelemetry() {
            vi.stubEnv("MST_TELEMETRY", "1");
            vi.stubEnv("OTEL_SDK_DISABLED", undefined);
            vi.stubEnv("TRACEPARENT", undefined);
            onTestFinished(forgetTelemetry);
            vi.resetModules();
            const telemetry = yield* Effect.promise(() => import("./check-telemetry.ts"));
            return yield* Effect.promise(() => telemetry.measureCheck(() => 41 + 1));
          }),
        ));

      it("comes back to whoever measured it", ({ checkProductWithTelemetry }) => {
        expect(checkProductWithTelemetry).toBe(42);
      });
    });

    describe("the span opened for an invocation carrying an entry point", () => {
      const it = test.extend("spanNameForEntryPoint", () =>
        Effect.runPromise(
          Effect.gen(function* spanNameForEntryPoint() {
            vi.stubEnv("MST_TELEMETRY", "1");
            vi.stubEnv("OTEL_SDK_DISABLED", undefined);
            vi.stubEnv("TRACEPARENT", undefined);
            forgetTelemetry();
            vi.resetModules();
            vi.spyOn(process, "argv", "get").mockReturnValue([
              "/usr/local/bin/node",
              "/repository/packages/dont-review-it/src/cli.ts",
              "check",
            ]);
            const traceExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-trace-otlp-http"),
            );
            const exported = vi.fn<(spanName: string) => void>();
            vi.spyOn(traceExporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
              (batch, resultCallback) => {
                for (const span of batch.filter(
                  (candidate) => candidate.instrumentationScope.name === INSTRUMENTATION_NAME,
                )) {
                  exported(span.name);
                }
                resultCallback({ code: 0 });
              },
            );
            const stopped = vi
              .spyOn(traceExporterModule.OTLPTraceExporter.prototype, "shutdown")
              .mockResolvedValue();
            const metricExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-metrics-otlp-http"),
            );
            vi.spyOn(
              metricExporterModule.OTLPMetricExporter.prototype,
              "export",
            ).mockImplementation((_batch, resultCallback) => {
              resultCallback({ code: 0 });
            });
            vi.spyOn(
              metricExporterModule.OTLPMetricExporter.prototype,
              "shutdown",
            ).mockResolvedValue();
            const started = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
            const running = started.startTelemetry("mst-check");
            onTestFinished(() => running.shutdown().then(forgetTelemetry));
            const telemetry = yield* Effect.promise(() => import("./check-telemetry.ts"));
            yield* Effect.promise(() => telemetry.measureCheck(() => 41 + 1));
            process.emit("beforeExit", 0);
            yield* Effect.promise(() => vi.waitUntil(() => stopped.mock.calls.length > 0));
            return exported;
          }),
        ));

      it("is named after the command that invoked the check", ({ spanNameForEntryPoint }) => {
        expect(spanNameForEntryPoint).toHaveBeenCalledExactlyOnceWith("cli.ts check");
      });
    });

    describe("the span opened for an invocation carrying no entry point", () => {
      const it = test.extend("spanNameWithoutEntryPoint", () =>
        Effect.runPromise(
          Effect.gen(function* spanNameWithoutEntryPoint() {
            vi.stubEnv("MST_TELEMETRY", "1");
            vi.stubEnv("OTEL_SDK_DISABLED", undefined);
            vi.stubEnv("TRACEPARENT", undefined);
            forgetTelemetry();
            vi.resetModules();
            vi.spyOn(process, "argv", "get").mockReturnValue(["/usr/local/bin/node"]);
            const traceExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-trace-otlp-http"),
            );
            const exported = vi.fn<(spanName: string) => void>();
            vi.spyOn(traceExporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
              (batch, resultCallback) => {
                for (const span of batch.filter(
                  (candidate) => candidate.instrumentationScope.name === INSTRUMENTATION_NAME,
                )) {
                  exported(span.name);
                }
                resultCallback({ code: 0 });
              },
            );
            const stopped = vi
              .spyOn(traceExporterModule.OTLPTraceExporter.prototype, "shutdown")
              .mockResolvedValue();
            const metricExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-metrics-otlp-http"),
            );
            vi.spyOn(
              metricExporterModule.OTLPMetricExporter.prototype,
              "export",
            ).mockImplementation((_batch, resultCallback) => {
              resultCallback({ code: 0 });
            });
            vi.spyOn(
              metricExporterModule.OTLPMetricExporter.prototype,
              "shutdown",
            ).mockResolvedValue();
            const started = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
            const running = started.startTelemetry("mst-check");
            onTestFinished(() => running.shutdown().then(forgetTelemetry));
            const telemetry = yield* Effect.promise(() => import("./check-telemetry.ts"));
            yield* Effect.promise(() => telemetry.measureCheck(() => 41 + 1));
            process.emit("beforeExit", 0);
            yield* Effect.promise(() => vi.waitUntil(() => stopped.mock.calls.length > 0));
            return exported;
          }),
        ));

      it("falls back to the name the checks answer to", ({ spanNameWithoutEntryPoint }) => {
        expect(spanNameWithoutEntryPoint).toHaveBeenCalledExactlyOnceWith("mst-check");
      });
    });

    describe("the span opened for a check that fails", () => {
      const refusal = new Error("check refused");
      const it = test.extend("spanForFailedCheck", () =>
        Effect.runPromise(
          Effect.gen(function* spanForFailedCheck() {
            vi.stubEnv("MST_TELEMETRY", "1");
            vi.stubEnv("OTEL_SDK_DISABLED", undefined);
            vi.stubEnv("TRACEPARENT", undefined);
            forgetTelemetry();
            vi.resetModules();
            vi.spyOn(process, "argv", "get").mockReturnValue(["/usr/local/bin/node"]);
            const traceExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-trace-otlp-http"),
            );
            const exported =
              vi.fn<
                (span: {
                  readonly events: readonly string[];
                  readonly status: Readonly<{ code: number; message?: string }>;
                }) => void
              >();
            vi.spyOn(traceExporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
              (batch, resultCallback) => {
                for (const span of batch.filter(
                  (candidate) => candidate.instrumentationScope.name === INSTRUMENTATION_NAME,
                )) {
                  exported({
                    events: span.events.map((event) => event.name),
                    status: span.status,
                  });
                }
                resultCallback({ code: 0 });
              },
            );
            const stopped = vi
              .spyOn(traceExporterModule.OTLPTraceExporter.prototype, "shutdown")
              .mockResolvedValue();
            const metricExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-metrics-otlp-http"),
            );
            vi.spyOn(
              metricExporterModule.OTLPMetricExporter.prototype,
              "export",
            ).mockImplementation((_batch, resultCallback) => {
              resultCallback({ code: 0 });
            });
            vi.spyOn(
              metricExporterModule.OTLPMetricExporter.prototype,
              "shutdown",
            ).mockResolvedValue();
            const started = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
            const running = started.startTelemetry("mst-check");
            onTestFinished(() => running.shutdown().then(forgetTelemetry));
            const telemetry = yield* Effect.promise(() => import("./check-telemetry.ts"));
            const rejected = yield* Effect.promise(() =>
              telemetry
                .measureCheck(() => Promise.reject(refusal))
                .then(
                  () => undefined,
                  (failure: unknown) => failure,
                ),
            );
            process.emit("beforeExit", 0);
            yield* Effect.promise(() => vi.waitUntil(() => stopped.mock.calls.length > 0));
            return { exported, rejected };
          }),
        ));

      it("still reaches whoever measured it", ({ spanForFailedCheck }) => {
        expect(spanForFailedCheck.rejected).toBe(refusal);
      });

      it("is closed with the failure recorded on it", ({ spanForFailedCheck }) => {
        expect(spanForFailedCheck.exported).toHaveBeenCalledExactlyOnceWith({
          events: ["exception"],
          status: { code: SpanStatusCode.ERROR, message: "check refused" },
        });
      });
    });
  });
});
