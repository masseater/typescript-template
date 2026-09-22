import { context, metrics, propagation, trace, TraceFlags } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { globalErrorHandler } from "@opentelemetry/core";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { Effect } from "effect";
import { pick } from "es-toolkit";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import packageManifest from "../../../../package.json" with { type: "json" };

const MEASURED_SERVICE = "mst-telemetry-under-test";

const SECOND_MEASURED_SERVICE = "mst-telemetry-asked-again";

const TRACER_NAME = "telemetry-under-test";

const MEASURED_SPAN = "the work being measured";

const EXPORT_FAILURE_PREFIX = "MST_TELEMETRY asked for telemetry, but it could not be exported: ";

const INHERITED_TRACE_ID = "0af7651916cd43dd8448eb211c80319c";

const INHERITED_SPAN_ID = "b7ad6b7169203331";

const INHERITED_TRACEPARENT = `00-${INHERITED_TRACE_ID}-${INHERITED_SPAN_ID}-01`;

const ACTIVE_TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";

const ACTIVE_SPAN_ID = "00f067aa0ba902b7";

const ACTIVE_TRACEPARENT = `00-${ACTIVE_TRACE_ID}-${ACTIVE_SPAN_ID}-01`;

describe("startTelemetry", () => {
  describe("an environment that never asked for telemetry", () => {
    const it = test.extend("spansExportedWithoutAsking", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", undefined);
          vi.stubEnv("OTEL_SDK_DISABLED", undefined);
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          onTestFinished(() => {
            process.exitCode = undefined;
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
          });
          vi.resetModules();
          const exporterModule = yield* Effect.promise(
            () => import("@opentelemetry/exporter-trace-otlp-http"),
          );
          const exported = vi.fn<(spanName: string) => void>();
          vi.spyOn(exporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
            (batch, resultCallback) => {
              for (const span of batch.filter(
                (candidate) => candidate.instrumentationScope.name === TRACER_NAME,
              )) {
                exported(span.name);
              }
              resultCallback({ code: 0 });
            },
          );
          const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
          const started = telemetry.startTelemetry(MEASURED_SERVICE);
          trace.getTracer(TRACER_NAME).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => started.shutdown());
          return exported;
        }),
      ));

    it("hands the exporter nothing at all", ({ spansExportedWithoutAsking }) => {
      expect(spansExportedWithoutAsking).toHaveBeenCalledTimes(0);
    });
  });

  describe("an environment that asked for telemetry but disabled the sdk", () => {
    const it = test.extend("spansExportedWithADisabledSdk", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", "1");
          vi.stubEnv("OTEL_SDK_DISABLED", "true");
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          onTestFinished(() => {
            process.exitCode = undefined;
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
          });
          vi.resetModules();
          const exporterModule = yield* Effect.promise(
            () => import("@opentelemetry/exporter-trace-otlp-http"),
          );
          const exported = vi.fn<(spanName: string) => void>();
          vi.spyOn(exporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
            (batch, resultCallback) => {
              for (const span of batch.filter(
                (candidate) => candidate.instrumentationScope.name === TRACER_NAME,
              )) {
                exported(span.name);
              }
              resultCallback({ code: 0 });
            },
          );
          const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
          const started = telemetry.startTelemetry(MEASURED_SERVICE);
          trace.getTracer(TRACER_NAME).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => started.shutdown());
          return exported;
        }),
      ));

    it("hands the exporter nothing even though it was asked", ({
      spansExportedWithADisabledSdk,
    }) => {
      expect(spansExportedWithADisabledSdk).toHaveBeenCalledTimes(0);
    });
  });

  describe("an environment that asked for telemetry", () => {
    const it = test.extend("spansExportedAfterAsking", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", "1");
          vi.stubEnv("OTEL_SDK_DISABLED", undefined);
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          vi.resetModules();
          const exporterModule = yield* Effect.promise(
            () => import("@opentelemetry/exporter-trace-otlp-http"),
          );
          const exported = vi.fn<(spanName: string) => void>();
          vi.spyOn(exporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
            (batch, resultCallback) => {
              for (const span of batch.filter(
                (candidate) => candidate.instrumentationScope.name === TRACER_NAME,
              )) {
                exported(span.name);
              }
              resultCallback({ code: 0 });
            },
          );
          const stopped = vi
            .spyOn(exporterModule.OTLPTraceExporter.prototype, "shutdown")
            .mockResolvedValue();
          const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
          const started = telemetry.startTelemetry(MEASURED_SERVICE);
          onTestFinished(() => {
            process.exitCode = undefined;
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            return started.shutdown();
          });
          trace.getTracer(TRACER_NAME).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => vi.waitUntil(() => stopped.mock.calls.length > 0));
          return exported;
        }),
      ));

    it("hands the exporter what was recorded under it", ({ spansExportedAfterAsking }) => {
      expect(spansExportedAfterAsking).toHaveBeenCalledExactlyOnceWith(MEASURED_SPAN);
    });
  });

  describe("a second entry asking for telemetry that already started", () => {
    const it = test.extend("servicesExportedAfterTheSecondEntry", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", "1");
          vi.stubEnv("OTEL_SDK_DISABLED", undefined);
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          vi.resetModules();
          const exporterModule = yield* Effect.promise(
            () => import("@opentelemetry/exporter-trace-otlp-http"),
          );
          const exported = vi.fn<(serviceName: unknown) => void>();
          vi.spyOn(exporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
            (batch, resultCallback) => {
              for (const span of batch.filter(
                (candidate) => candidate.instrumentationScope.name === TRACER_NAME,
              )) {
                exported(span.resource.attributes[ATTR_SERVICE_NAME]);
              }
              resultCallback({ code: 0 });
            },
          );
          const stopped = vi
            .spyOn(exporterModule.OTLPTraceExporter.prototype, "shutdown")
            .mockResolvedValue();
          const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
          const started = telemetry.startTelemetry(MEASURED_SERVICE);
          onTestFinished(() => {
            process.exitCode = undefined;
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            return started.shutdown();
          });
          telemetry.startTelemetry(SECOND_MEASURED_SERVICE);
          trace.getTracer(TRACER_NAME).startActiveSpan(MEASURED_SPAN, (span) => {
            span.end();
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => vi.waitUntil(() => stopped.mock.calls.length > 0));
          return exported;
        }),
      ));

    it("keeps the service the first entry named", ({ servicesExportedAfterTheSecondEntry }) => {
      expect(servicesExportedAfterTheSecondEntry).toHaveBeenCalledExactlyOnceWith(MEASURED_SERVICE);
    });
  });

  describe("a process winding down after telemetry started", () => {
    const it = test.extend("stoppedExporters", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", "1");
          vi.stubEnv("OTEL_SDK_DISABLED", undefined);
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          vi.resetModules();
          const stopped = vi.fn<(stoppedSignal: string) => void>();
          const traceExporterModule = yield* Effect.promise(
            () => import("@opentelemetry/exporter-trace-otlp-http"),
          );
          vi.spyOn(traceExporterModule.OTLPTraceExporter.prototype, "shutdown").mockImplementation(
            () => {
              stopped("traces");
              return Promise.resolve();
            },
          );
          const metricExporterModule = yield* Effect.promise(
            () => import("@opentelemetry/exporter-metrics-otlp-http"),
          );
          vi.spyOn(
            metricExporterModule.OTLPMetricExporter.prototype,
            "shutdown",
          ).mockImplementation(() => {
            stopped("metrics");
            return Promise.resolve();
          });
          const logExporterModule = yield* Effect.promise(
            () => import("@opentelemetry/exporter-logs-otlp-http"),
          );
          vi.spyOn(logExporterModule.OTLPLogExporter.prototype, "shutdown").mockImplementation(
            () => {
              stopped("logs");
              return Promise.resolve();
            },
          );
          const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
          const started = telemetry.startTelemetry(MEASURED_SERVICE);
          onTestFinished(() => {
            process.exitCode = undefined;
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            return started.shutdown();
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => started.shutdown());
          return stopped;
        }),
      ));

    it("stops every exporter it started", ({ stoppedExporters }) => {
      expect(stoppedExporters).toHaveBeenCalledTimes(3);
    });
  });

  describe("an export that fails", () => {
    describe("the exit code the process carried when the failure was reported", () => {
      const it = test.extend("exitCodeCarriedIntoTheReport", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("MST_TELEMETRY", "1");
            vi.stubEnv("OTEL_SDK_DISABLED", undefined);
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            vi.resetModules();
            const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
            const started = telemetry.startTelemetry(MEASURED_SERVICE);
            onTestFinished(() => {
              process.exitCode = undefined;
              process.removeAllListeners("beforeExit");
              context.disable();
              propagation.disable();
              trace.disable();
              metrics.disable();
              logs.disable();
              return started.shutdown();
            });
            const marked = vi.fn<(exitCode: unknown) => void>();
            vi.spyOn(process.stderr, "write").mockImplementation(() => {
              marked(process.exitCode);
              return true;
            });
            globalErrorHandler(new Error("the collector refused"));
            return marked;
          }),
        ));

      it("marks the process as failed before the report goes out", ({
        exitCodeCarriedIntoTheReport,
      }) => {
        expect(exitCodeCarriedIntoTheReport).toHaveBeenCalledExactlyOnceWith(1);
      });
    });

    describe("a failure carrying an error", () => {
      const it = test.extend("thrownErrorReport", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("MST_TELEMETRY", "1");
            vi.stubEnv("OTEL_SDK_DISABLED", undefined);
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            vi.resetModules();
            const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
            const started = telemetry.startTelemetry(MEASURED_SERVICE);
            onTestFinished(() => {
              process.exitCode = undefined;
              process.removeAllListeners("beforeExit");
              context.disable();
              propagation.disable();
              trace.disable();
              metrics.disable();
              logs.disable();
              return started.shutdown();
            });
            const written = vi.fn<(failureReport: string) => void>();
            vi.spyOn(process.stderr, "write").mockImplementation((failureReport) => {
              written(String(failureReport));
              return true;
            });
            globalErrorHandler(new Error("the collector refused"));
            return written;
          }),
        ));

      it("names the message the error carried", ({ thrownErrorReport }) => {
        expect(thrownErrorReport).toHaveBeenCalledExactlyOnceWith(
          `${EXPORT_FAILURE_PREFIX}the collector refused\n`,
        );
      });
    });

    describe("a failure carrying a value that is not an error", () => {
      const it = test.extend("thrownNonErrorReport", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("MST_TELEMETRY", "1");
            vi.stubEnv("OTEL_SDK_DISABLED", undefined);
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            vi.resetModules();
            const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
            const started = telemetry.startTelemetry(MEASURED_SERVICE);
            onTestFinished(() => {
              process.exitCode = undefined;
              process.removeAllListeners("beforeExit");
              context.disable();
              propagation.disable();
              trace.disable();
              metrics.disable();
              logs.disable();
              return started.shutdown();
            });
            const written = vi.fn<(failureReport: string) => void>();
            vi.spyOn(process.stderr, "write").mockImplementation((failureReport) => {
              written(String(failureReport));
              return true;
            });
            globalErrorHandler({ code: "503" });
            return written;
          }),
        ));

      it("names the value that was thrown", ({ thrownNonErrorReport }) => {
        expect(thrownNonErrorReport).toHaveBeenCalledExactlyOnceWith(
          `${EXPORT_FAILURE_PREFIX}{"code":"503"}\n`,
        );
      });
    });

    describe("a shutdown that cannot reach the sink", () => {
      const it = test.extend("shutdownFailureReport", () =>
        Effect.runPromise(
          Effect.gen(function* () {
            vi.stubEnv("MST_TELEMETRY", "1");
            vi.stubEnv("OTEL_SDK_DISABLED", undefined);
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            onTestFinished(() => {
              process.exitCode = undefined;
              process.removeAllListeners("beforeExit");
              context.disable();
              propagation.disable();
              trace.disable();
              metrics.disable();
              logs.disable();
            });
            vi.resetModules();
            const exporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-trace-otlp-http"),
            );
            vi.spyOn(exporterModule.OTLPTraceExporter.prototype, "shutdown").mockRejectedValue(
              new Error("the collector went away"),
            );
            const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
            const started = telemetry.startTelemetry(MEASURED_SERVICE);
            const written = vi.fn<(failureReport: string) => void>();
            vi.spyOn(process.stderr, "write").mockImplementation((failureReport) => {
              written(String(failureReport));
              return true;
            });
            yield* Effect.promise(() => started.shutdown());
            return written;
          }),
        ));

      it("reports the failure instead of leaving the rejection unhandled", ({
        shutdownFailureReport,
      }) => {
        expect(shutdownFailureReport).toHaveBeenCalledExactlyOnceWith(
          `${EXPORT_FAILURE_PREFIX}the collector went away\n`,
        );
      });
    });
  });
});

describe("inheritedContext", () => {
  describe("an environment carrying a trace context", () => {
    const it = test.extend("inheritedSpanContext", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", "1");
          vi.stubEnv("OTEL_SDK_DISABLED", undefined);
          vi.stubEnv("TRACEPARENT", INHERITED_TRACEPARENT);
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          vi.resetModules();
          const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
          const started = telemetry.startTelemetry(MEASURED_SERVICE);
          onTestFinished(() => {
            process.exitCode = undefined;
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            return started.shutdown();
          });
          return trace.getSpanContext(telemetry.inheritedContext());
        }),
      ));

    it("names the span the caller was started from", ({ inheritedSpanContext }) => {
      expect(inheritedSpanContext).toStrictEqual({
        traceId: INHERITED_TRACE_ID,
        spanId: INHERITED_SPAN_ID,
        traceFlags: TraceFlags.SAMPLED,
        isRemote: true,
      });
    });
  });

  describe("an environment carrying no trace context", () => {
    const it = test.extend("spanContextInheritedFromNothing", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", "1");
          vi.stubEnv("OTEL_SDK_DISABLED", undefined);
          vi.stubEnv("TRACEPARENT", undefined);
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          vi.resetModules();
          const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
          const started = telemetry.startTelemetry(MEASURED_SERVICE);
          onTestFinished(() => {
            process.exitCode = undefined;
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            return started.shutdown();
          });
          return trace.getSpanContext(telemetry.inheritedContext());
        }),
      ));

    it("names no span at all", ({ spanContextInheritedFromNothing }) => {
      expect(spanContextInheritedFromNothing).toBe(undefined);
    });
  });
});

describe("environmentCarryingContext", () => {
  describe("an environment carried out of an active trace", () => {
    const it = test.extend("traceCarriedToAChild", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", "1");
          vi.stubEnv("OTEL_SDK_DISABLED", undefined);
          vi.stubEnv("TRACEPARENT", INHERITED_TRACEPARENT);
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          vi.resetModules();
          const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
          const started = telemetry.startTelemetry(MEASURED_SERVICE);
          onTestFinished(() => {
            process.exitCode = undefined;
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            return started.shutdown();
          });
          return context.with(
            trace.setSpanContext(context.active(), {
              traceId: ACTIVE_TRACE_ID,
              spanId: ACTIVE_SPAN_ID,
              traceFlags: TraceFlags.SAMPLED,
            }),
            () => pick(telemetry.environmentCarryingContext(), ["TRACEPARENT"]),
          );
        }),
      ));

    it("overwrites the trace the wrapper itself was handed", ({ traceCarriedToAChild }) => {
      expect(traceCarriedToAChild).toStrictEqual({ TRACEPARENT: ACTIVE_TRACEPARENT });
    });
  });

  describe("an environment carried out of no trace at all", () => {
    const it = test.extend("traceCarriedToAChildOfNoSpan", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", "1");
          vi.stubEnv("OTEL_SDK_DISABLED", undefined);
          vi.stubEnv("TRACEPARENT", undefined);
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          vi.resetModules();
          const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
          const started = telemetry.startTelemetry(MEASURED_SERVICE);
          onTestFinished(() => {
            process.exitCode = undefined;
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
            return started.shutdown();
          });
          return pick(telemetry.environmentCarryingContext(), ["TRACEPARENT"]);
        }),
      ));

    it("hands the child no trace at all", ({ traceCarriedToAChildOfNoSpan }) => {
      expect(traceCarriedToAChildOfNoSpan).toStrictEqual({});
    });
  });

  describe("an environment holding a name with no value", () => {
    const it = test.extend("environmentCarriedToAChild", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", undefined);
          vi.stubEnv("OTEL_SDK_DISABLED", undefined);
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          onTestFinished(() => {
            process.exitCode = undefined;
            process.removeAllListeners("beforeExit");
            context.disable();
            propagation.disable();
            trace.disable();
            metrics.disable();
            logs.disable();
          });
          vi.resetModules();
          const telemetry = yield* Effect.promise(() => import("./telemetry.ts"));
          vi.stubEnv("MST_TELEMETRY_KEPT", "kept");
          vi.stubEnv("MST_TELEMETRY_UNSET", undefined);
          return pick(telemetry.environmentCarryingContext(), [
            "MST_TELEMETRY_KEPT",
            "MST_TELEMETRY_UNSET",
          ]);
        }),
      ));

    it("leaves out the name that had no value", ({ environmentCarriedToAChild }) => {
      expect(environmentCarriedToAChild).toStrictEqual({ MST_TELEMETRY_KEPT: "kept" });
    });
  });
});

describe("the package surface", () => {
  const it = test.extend("declaredManifest", () => packageManifest);

  it("is imported and not run", ({ declaredManifest }) => {
    expect(declaredManifest).toStrictEqual({
      name: "@repo/ai-native-telemetry",
      version: "0.0.0",
      description: "One OpenTelemetry provider startup for a process.",
      keywords: ["tanstack-intent"],
      license: "MIT",
      repository: {
        type: "git",
        url: "git+https://github.com/masseater/typescript-template.git",
        directory: "tools/ai-native-telemetry",
      },
      files: ["dist"],
      type: "module",
      sideEffects: false,
      exports: {
        ".": "./src/features/ai-native-telemetry/telemetry/telemetry.ts",
        "./optional-setting": "./src/features/ai-native-telemetry/telemetry/optional-setting.ts",
        "./vitest-sdk": "./src/features/ai-native-telemetry/telemetry/vitest-sdk.ts",
        "./package.json": "./package.json",
      },
      publishConfig: {
        exports: {
          ".": {
            types: "./dist/telemetry/telemetry.d.mts",
            default: "./dist/telemetry/telemetry.mjs",
          },
          "./optional-setting": {
            types: "./dist/telemetry/optional-setting.d.mts",
            default: "./dist/telemetry/optional-setting.mjs",
          },
          "./vitest-sdk": {
            types: "./dist/telemetry/vitest-sdk.d.mts",
            default: "./dist/telemetry/vitest-sdk.mjs",
          },
          "./package.json": "./package.json",
        },
        access: "public",
      },
      dependencies: {
        "@opentelemetry/api": "catalog:",
        "@opentelemetry/api-logs": "0.221.0",
        "@opentelemetry/context-async-hooks": "2.10.0",
        "@opentelemetry/core": "catalog:",
        "@opentelemetry/exporter-logs-otlp-http": "0.221.0",
        "@opentelemetry/exporter-metrics-otlp-http": "catalog:",
        "@opentelemetry/exporter-trace-otlp-http": "0.221.0",
        "@opentelemetry/propagator-env-carrier": "0.221.0",
        "@opentelemetry/resources": "2.10.0",
        "@opentelemetry/sdk-logs": "0.221.0",
        "@opentelemetry/sdk-metrics": "catalog:",
        "@opentelemetry/sdk-trace": "2.10.0",
        "@opentelemetry/semantic-conventions": "1.43.0",
        effect: "catalog:",
        "es-toolkit": "catalog:",
      },
      devDependencies: {
        "@repo/vite-config": "workspace:*",
        "@tanstack/intent": "catalog:",
        "@types/node": "catalog:",
        "@vitest/coverage-v8": "catalog:",
        typescript: "catalog:",
        vite: "catalog:",
        "vite-plus": "catalog:",
      },
    });
  });
});
