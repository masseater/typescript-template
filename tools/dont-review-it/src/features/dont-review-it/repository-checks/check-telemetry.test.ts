import { context, metrics, propagation, trace } from "@opentelemetry/api";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

const INSTRUMENTATION_NAME = "@repo/dont-review-it/repository-checks";

describe("measureCheck", () => {
  describe("a check measured in an environment that never asked for telemetry", () => {
    describe("what the measured check produced", () => {
      const it = test.extend("checkProductWithoutTelemetry", async () => {
        vi.stubEnv("MST_TELEMETRY", undefined);
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          metrics.disable();
          propagation.disable();
          trace.disable();
        });
        vi.resetModules();
        const telemetry = await import("./check-telemetry.ts");
        return telemetry.measureCheck(() => 41 + 1);
      });

      it("comes back to whoever measured it", ({ checkProductWithoutTelemetry }) => {
        expect(checkProductWithoutTelemetry).toBe(42);
      });
    });

    describe("the span the check ran under", () => {
      const it = test.extend("spanWithoutTelemetry", async () => {
        vi.stubEnv("MST_TELEMETRY", undefined);
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          metrics.disable();
          propagation.disable();
          trace.disable();
        });
        vi.resetModules();
        const telemetry = await import("./check-telemetry.ts");
        return telemetry.measureCheck(() => trace.getSpan(context.active()));
      });

      it("was never opened", ({ spanWithoutTelemetry }) => {
        expect(spanWithoutTelemetry).toBe(undefined);
      });
    });
  });

  describe("a check measured in an environment that asked for telemetry", () => {
    describe("what the measured check produced", () => {
      const it = test.extend("checkProductWithTelemetry", async () => {
        vi.stubEnv("MST_TELEMETRY", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        vi.stubEnv("TRACEPARENT", undefined);
        onTestFinished(() => {
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          metrics.disable();
          propagation.disable();
          trace.disable();
        });
        vi.resetModules();
        const telemetry = await import("./check-telemetry.ts");
        return telemetry.measureCheck(() => 41 + 1);
      });

      it("comes back to whoever measured it", ({ checkProductWithTelemetry }) => {
        expect(checkProductWithTelemetry).toBe(42);
      });
    });

    describe("the span opened for an invocation carrying an entry point", () => {
      const it = test.extend("spanNameForEntryPoint", async () => {
        vi.stubEnv("MST_TELEMETRY", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        vi.stubEnv("TRACEPARENT", undefined);
        process.removeAllListeners("beforeExit");
        context.disable();
        metrics.disable();
        propagation.disable();
        trace.disable();
        vi.resetModules();
        vi.spyOn(process, "argv", "get").mockReturnValue([
          "/usr/local/bin/node",
          "/repository/packages/dont-review-it/src/cli.ts",
          "check",
        ]);
        const traceExporterModule = await import("@opentelemetry/exporter-trace-otlp-http");
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
        const metricExporterModule = await import("@opentelemetry/exporter-metrics-otlp-http");
        vi.spyOn(metricExporterModule.OTLPMetricExporter.prototype, "export").mockImplementation(
          (_batch, resultCallback) => {
            resultCallback({ code: 0 });
          },
        );
        vi.spyOn(metricExporterModule.OTLPMetricExporter.prototype, "shutdown").mockResolvedValue();
        const started = await import("@repo/ai-native-telemetry");
        const running = started.startTelemetry("mst-check");
        onTestFinished(async () => {
          await running.shutdown();
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          metrics.disable();
          propagation.disable();
          trace.disable();
        });
        const telemetry = await import("./check-telemetry.ts");
        await telemetry.measureCheck(() => 41 + 1);
        process.emit("beforeExit", 0);
        await vi.waitUntil(() => stopped.mock.calls.length > 0);
        return exported;
      });

      it("is named after the command that invoked the check", ({ spanNameForEntryPoint }) => {
        expect(spanNameForEntryPoint).toHaveBeenCalledExactlyOnceWith("cli.ts check");
      });
    });

    describe("the span opened for an invocation carrying no entry point", () => {
      const it = test.extend("spanNameWithoutEntryPoint", async () => {
        vi.stubEnv("MST_TELEMETRY", "1");
        vi.stubEnv("OTEL_SDK_DISABLED", undefined);
        vi.stubEnv("TRACEPARENT", undefined);
        process.removeAllListeners("beforeExit");
        context.disable();
        metrics.disable();
        propagation.disable();
        trace.disable();
        vi.resetModules();
        vi.spyOn(process, "argv", "get").mockReturnValue(["/usr/local/bin/node"]);
        const traceExporterModule = await import("@opentelemetry/exporter-trace-otlp-http");
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
        const metricExporterModule = await import("@opentelemetry/exporter-metrics-otlp-http");
        vi.spyOn(metricExporterModule.OTLPMetricExporter.prototype, "export").mockImplementation(
          (_batch, resultCallback) => {
            resultCallback({ code: 0 });
          },
        );
        vi.spyOn(metricExporterModule.OTLPMetricExporter.prototype, "shutdown").mockResolvedValue();
        const started = await import("@repo/ai-native-telemetry");
        const running = started.startTelemetry("mst-check");
        onTestFinished(async () => {
          await running.shutdown();
          process.exitCode = undefined;
          process.removeAllListeners("beforeExit");
          context.disable();
          metrics.disable();
          propagation.disable();
          trace.disable();
        });
        const telemetry = await import("./check-telemetry.ts");
        await telemetry.measureCheck(() => 41 + 1);
        process.emit("beforeExit", 0);
        await vi.waitUntil(() => stopped.mock.calls.length > 0);
        return exported;
      });

      it("falls back to the name the checks answer to", ({ spanNameWithoutEntryPoint }) => {
        expect(spanNameWithoutEntryPoint).toHaveBeenCalledExactlyOnceWith("mst-check");
      });
    });
  });
});
