import { context, metrics, propagation, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { Effect } from "effect";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

describe("the sdk vitest is handed", () => {
  const it = test.extend("exporterStoppedBySdkShutdown", () =>
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
        const stopped = vi
          .spyOn(exporterModule.OTLPTraceExporter.prototype, "shutdown")
          .mockResolvedValue();
        const sdk = yield* Effect.promise(() => import("./vitest-sdk.ts"));
        yield* Effect.promise(() => sdk.default.shutdown());
        return stopped;
      }),
    ));

  it("stops what the telemetry it started opened", ({ exporterStoppedBySdkShutdown }) => {
    expect(exporterStoppedBySdkShutdown).toHaveBeenCalledTimes(1);
  });
});
