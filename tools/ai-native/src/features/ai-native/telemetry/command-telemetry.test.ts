import { env as processEnvironment } from "node:process";

import {
  context,
  metrics,
  propagation,
  SpanStatusCode,
  trace,
  TraceFlags,
  type Attributes,
} from "@opentelemetry/api";
import { logs, SeverityNumber, type AnyValue, type AnyValueMap } from "@opentelemetry/api-logs";
import { DataPointType } from "@opentelemetry/sdk-metrics";
import {
  ATTR_PROCESS_COMMAND_ARGS,
  ATTR_PROCESS_EXECUTABLE_NAME,
  ATTR_PROCESS_EXIT_CODE,
} from "@opentelemetry/semantic-conventions/incubating";
import { Effect } from "effect";
import { pick } from "es-toolkit";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import packageManifest from "../../../../package.json" with { type: "json" };

import type { Command } from "../spool/parse-command.ts";

type ExportedSpan = {
  readonly name: string;
  readonly statusCode: SpanStatusCode;
  readonly attributes: Attributes;
};

type ExportedDuration = {
  readonly name: string;
  readonly count: number;
  readonly attributes: Attributes;
};

type ExportedRecord = {
  readonly eventName: string | undefined;
  readonly severityNumber: SeverityNumber | undefined;
  readonly body: AnyValue;
  readonly attributes: AnyValueMap;
};

const MEASURED_SERVICE = "mst-command-under-test";

const MEASURED_INSTRUMENTATION = "@repo/ai-native";

const MEASURED_EXECUTABLE = "node";

const MEASURED_COMMAND: Command = [MEASURED_EXECUTABLE, "--version"];

const MEASURED_COMMAND_LINE = MEASURED_COMMAND.join(" ");

const FAILING_EXIT_CODE = 7;

const ACTIVE_TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";

const ACTIVE_SPAN_ID = "00f067aa0ba902b7";

const ACTIVE_TRACEPARENT = `00-${ACTIVE_TRACE_ID}-${ACTIVE_SPAN_ID}-01`;

const STALE_TRACEPARENT = "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01";

const RECORD_PATH = "/tmp/spool/20260814T000000Z-node-cafe0123.log";

const RECORD_BYTES = 42;

const RECORD_LINES = 3;

const RECORD_EXCERPT = "the last line the command wrote\n";

describe("childEnvironment", () => {
  describe("an environment that never asked for telemetry", () => {
    const it = test.extend("childEnvironmentWithoutTelemetry", () =>
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
          const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
          return commandTelemetry.childEnvironment();
        }),
      ));

    it("is the environment the wrapper itself runs in", ({ childEnvironmentWithoutTelemetry }) => {
      expect(childEnvironmentWithoutTelemetry).toBe(processEnvironment);
    });
  });

  describe("an environment that asked for telemetry", () => {
    const it = test.extend("traceCarriedToTheChild", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          vi.stubEnv("MST_TELEMETRY", "1");
          vi.stubEnv("OTEL_SDK_DISABLED", undefined);
          vi.stubEnv("TRACEPARENT", STALE_TRACEPARENT);
          process.removeAllListeners("beforeExit");
          context.disable();
          propagation.disable();
          trace.disable();
          metrics.disable();
          logs.disable();
          vi.resetModules();
          const telemetry = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
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
          const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
          return context.with(
            trace.setSpanContext(context.active(), {
              traceId: ACTIVE_TRACE_ID,
              spanId: ACTIVE_SPAN_ID,
              traceFlags: TraceFlags.SAMPLED,
            }),
            () => {
              const environment = commandTelemetry.childEnvironment();
              return environment === undefined ? {} : pick(environment, ["TRACEPARENT"]);
            },
          );
        }),
      ));

    it("hands the child the span the command runs under", ({ traceCarriedToTheChild }) => {
      expect(traceCarriedToTheChild).toStrictEqual({ TRACEPARENT: ACTIVE_TRACEPARENT });
    });
  });
});

describe("measureCommand", () => {
  describe("a command measured in an environment that never asked for telemetry", () => {
    describe("what the measured command produced", () => {
      const it = test.extend("codeOfACommandNobodyMeasured", () =>
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
            const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
            return yield* Effect.promise(() =>
              commandTelemetry.measureCommand({
                command: MEASURED_COMMAND,
                run: () => Promise.resolve(FAILING_EXIT_CODE),
              }),
            );
          }),
        ));

      it("comes back to whoever wrapped it", ({ codeOfACommandNobodyMeasured }) => {
        expect(codeOfACommandNobodyMeasured).toBe(FAILING_EXIT_CODE);
      });
    });

    describe("the exporter behind a command nobody asked to measure", () => {
      const it = test.extend("spansOfACommandNobodyMeasured", () =>
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
                  (candidate) => candidate.instrumentationScope.name === MEASURED_INSTRUMENTATION,
                )) {
                  exported(span.name);
                }
                resultCallback({ code: 0 });
              },
            );
            const telemetry = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
            const started = telemetry.startTelemetry(MEASURED_SERVICE);
            const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
            yield* Effect.promise(() =>
              commandTelemetry.measureCommand({
                command: MEASURED_COMMAND,
                run: () => Promise.resolve(0),
              }),
            );
            process.emit("beforeExit", 0);
            yield* Effect.promise(() => started.shutdown());
            return exported;
          }),
        ));

      it("is handed nothing at all", ({ spansOfACommandNobodyMeasured }) => {
        expect(spansOfACommandNobodyMeasured).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe("a command measured in an environment that asked for telemetry", () => {
    describe("what the measured command produced", () => {
      const it = test.extend("codeOfAMeasuredCommand", () =>
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
            const traceExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-trace-otlp-http"),
            );
            vi.spyOn(traceExporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
              (_batch, resultCallback) => {
                resultCallback({ code: 0 });
              },
            );
            vi.spyOn(
              traceExporterModule.OTLPTraceExporter.prototype,
              "shutdown",
            ).mockResolvedValue();
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
            const telemetry = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
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
            const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
            return yield* Effect.promise(() =>
              commandTelemetry.measureCommand({
                command: MEASURED_COMMAND,
                run: () => Promise.resolve(FAILING_EXIT_CODE),
              }),
            );
          }),
        ));

      it("comes back to whoever wrapped it", ({ codeOfAMeasuredCommand }) => {
        expect(codeOfAMeasuredCommand).toBe(FAILING_EXIT_CODE);
      });
    });

    describe("the spans the exporter was handed after a command succeeded", () => {
      const it = test.extend("spansOfASucceedingCommand", () =>
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
            const traceExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-trace-otlp-http"),
            );
            const exported = vi.fn<(span: ExportedSpan) => void>();
            vi.spyOn(traceExporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
              (batch, resultCallback) => {
                for (const span of batch.filter(
                  (candidate) => candidate.instrumentationScope.name === MEASURED_INSTRUMENTATION,
                )) {
                  exported({
                    name: span.name,
                    statusCode: span.status.code,
                    attributes: span.attributes,
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
            const telemetry = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
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
            const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
            yield* Effect.promise(() =>
              commandTelemetry.measureCommand({
                command: MEASURED_COMMAND,
                run: () => Promise.resolve(0),
              }),
            );
            process.emit("beforeExit", 0);
            yield* Effect.promise(() => vi.waitUntil(() => stopped.mock.calls.length > 0));
            return exported;
          }),
        ));

      it("carry the command line, its parts and the code it ended with", ({
        spansOfASucceedingCommand,
      }) => {
        expect(spansOfASucceedingCommand).toHaveBeenCalledExactlyOnceWith({
          name: MEASURED_COMMAND_LINE,
          statusCode: SpanStatusCode.UNSET,
          attributes: {
            [ATTR_PROCESS_EXECUTABLE_NAME]: MEASURED_EXECUTABLE,
            [ATTR_PROCESS_COMMAND_ARGS]: [...MEASURED_COMMAND],
            [ATTR_PROCESS_EXIT_CODE]: 0,
          },
        });
      });
    });

    describe("the spans the exporter was handed after a command failed", () => {
      const it = test.extend("spansOfAFailingCommand", () =>
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
            const traceExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-trace-otlp-http"),
            );
            const exported = vi.fn<(span: ExportedSpan) => void>();
            vi.spyOn(traceExporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
              (batch, resultCallback) => {
                for (const span of batch.filter(
                  (candidate) => candidate.instrumentationScope.name === MEASURED_INSTRUMENTATION,
                )) {
                  exported({
                    name: span.name,
                    statusCode: span.status.code,
                    attributes: span.attributes,
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
            const telemetry = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
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
            const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
            yield* Effect.promise(() =>
              commandTelemetry.measureCommand({
                command: MEASURED_COMMAND,
                run: () => Promise.resolve(FAILING_EXIT_CODE),
              }),
            );
            process.emit("beforeExit", 0);
            yield* Effect.promise(() => vi.waitUntil(() => stopped.mock.calls.length > 0));
            return exported;
          }),
        ));

      it("carry the failure alongside the code it ended with", ({ spansOfAFailingCommand }) => {
        expect(spansOfAFailingCommand).toHaveBeenCalledExactlyOnceWith({
          name: MEASURED_COMMAND_LINE,
          statusCode: SpanStatusCode.ERROR,
          attributes: {
            [ATTR_PROCESS_EXECUTABLE_NAME]: MEASURED_EXECUTABLE,
            [ATTR_PROCESS_COMMAND_ARGS]: [...MEASURED_COMMAND],
            [ATTR_PROCESS_EXIT_CODE]: FAILING_EXIT_CODE,
          },
        });
      });
    });

    describe("the durations the metric exporter was handed", () => {
      const it = test.extend("durationsOfAMeasuredCommand", () =>
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
            const traceExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-trace-otlp-http"),
            );
            vi.spyOn(traceExporterModule.OTLPTraceExporter.prototype, "export").mockImplementation(
              (_batch, resultCallback) => {
                resultCallback({ code: 0 });
              },
            );
            vi.spyOn(
              traceExporterModule.OTLPTraceExporter.prototype,
              "shutdown",
            ).mockResolvedValue();
            const metricExporterModule = yield* Effect.promise(
              () => import("@opentelemetry/exporter-metrics-otlp-http"),
            );
            const exported = vi.fn<(duration: ExportedDuration) => void>();
            vi.spyOn(
              metricExporterModule.OTLPMetricExporter.prototype,
              "export",
            ).mockImplementation((batch, resultCallback) => {
              for (const duration of batch.scopeMetrics
                .filter((scope) => scope.scope.name === MEASURED_INSTRUMENTATION)
                .flatMap((scope) =>
                  scope.metrics.flatMap((metric) =>
                    metric.dataPointType === DataPointType.HISTOGRAM
                      ? metric.dataPoints.map((point) => ({
                          name: metric.descriptor.name,
                          count: point.value.count,
                          attributes: point.attributes,
                        }))
                      : [],
                  ),
                )) {
                exported(duration);
              }
              resultCallback({ code: 0 });
            });
            const stopped = vi
              .spyOn(metricExporterModule.OTLPMetricExporter.prototype, "shutdown")
              .mockResolvedValue();
            const telemetry = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
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
            const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
            yield* Effect.promise(() =>
              commandTelemetry.measureCommand({
                command: MEASURED_COMMAND,
                run: () => Promise.resolve(FAILING_EXIT_CODE),
              }),
            );
            process.emit("beforeExit", 0);
            yield* Effect.promise(() => vi.waitUntil(() => stopped.mock.calls.length > 0));
            return exported;
          }),
        ));

      it("count the wrapped run under the command that ended with it", ({
        durationsOfAMeasuredCommand,
      }) => {
        expect(durationsOfAMeasuredCommand).toHaveBeenCalledExactlyOnceWith({
          name: "command.duration",
          count: 1,
          attributes: {
            [ATTR_PROCESS_EXECUTABLE_NAME]: MEASURED_EXECUTABLE,
            [ATTR_PROCESS_EXIT_CODE]: FAILING_EXIT_CODE,
          },
        });
      });
    });
  });
});

describe("recordCommandRecord", () => {
  describe("a record written in an environment that never asked for telemetry", () => {
    const it = test.extend("recordsWithoutTelemetry", () =>
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
            () => import("@opentelemetry/exporter-logs-otlp-http"),
          );
          const exported = vi.fn<(eventName: string | undefined) => void>();
          vi.spyOn(exporterModule.OTLPLogExporter.prototype, "export").mockImplementation(
            (batch, resultCallback) => {
              for (const emitted of batch.filter(
                (candidate) => candidate.instrumentationScope.name === MEASURED_INSTRUMENTATION,
              )) {
                exported(emitted.eventName);
              }
              resultCallback({ code: 0 });
            },
          );
          const telemetry = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
          const started = telemetry.startTelemetry(MEASURED_SERVICE);
          const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
          commandTelemetry.recordCommandRecord({
            commandLine: MEASURED_COMMAND_LINE,
            exitCode: 0,
            filePath: RECORD_PATH,
            bytes: RECORD_BYTES,
            lineCount: RECORD_LINES,
            excerpt: RECORD_EXCERPT,
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => started.shutdown());
          return exported;
        }),
      ));

    it("is handed nothing at all", ({ recordsWithoutTelemetry }) => {
      expect(recordsWithoutTelemetry).toHaveBeenCalledTimes(0);
    });
  });

  describe("a record of a command that succeeded", () => {
    const it = test.extend("recordsOfASucceedingCommand", () =>
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
            () => import("@opentelemetry/exporter-logs-otlp-http"),
          );
          const exported = vi.fn<(emitted: ExportedRecord) => void>();
          vi.spyOn(exporterModule.OTLPLogExporter.prototype, "export").mockImplementation(
            (batch, resultCallback) => {
              for (const emitted of batch.filter(
                (candidate) => candidate.instrumentationScope.name === MEASURED_INSTRUMENTATION,
              )) {
                exported({
                  eventName: emitted.eventName,
                  severityNumber: emitted.severityNumber,
                  body: emitted.body,
                  attributes: emitted.attributes,
                });
              }
              resultCallback({ code: 0 });
            },
          );
          const stopped = vi
            .spyOn(exporterModule.OTLPLogExporter.prototype, "shutdown")
            .mockResolvedValue();
          const telemetry = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
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
          const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
          commandTelemetry.recordCommandRecord({
            commandLine: MEASURED_COMMAND_LINE,
            exitCode: 0,
            filePath: RECORD_PATH,
            bytes: RECORD_BYTES,
            lineCount: RECORD_LINES,
            excerpt: RECORD_EXCERPT,
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => vi.waitUntil(() => stopped.mock.calls.length > 0));
          return exported;
        }),
      ));

    it("carry the excerpt and where the whole record went", ({ recordsOfASucceedingCommand }) => {
      expect(recordsOfASucceedingCommand).toHaveBeenCalledExactlyOnceWith({
        eventName: "mst.command.record",
        severityNumber: SeverityNumber.INFO,
        body: RECORD_EXCERPT,
        attributes: {
          "command.line": MEASURED_COMMAND_LINE,
          "command.record.path": RECORD_PATH,
          "command.record.bytes": RECORD_BYTES,
          "command.record.lines": RECORD_LINES,
          [ATTR_PROCESS_EXIT_CODE]: 0,
        },
      });
    });
  });

  describe("a record of a command that failed", () => {
    const it = test.extend("recordsOfAFailingCommand", () =>
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
            () => import("@opentelemetry/exporter-logs-otlp-http"),
          );
          const exported = vi.fn<(emitted: ExportedRecord) => void>();
          vi.spyOn(exporterModule.OTLPLogExporter.prototype, "export").mockImplementation(
            (batch, resultCallback) => {
              for (const emitted of batch.filter(
                (candidate) => candidate.instrumentationScope.name === MEASURED_INSTRUMENTATION,
              )) {
                exported({
                  eventName: emitted.eventName,
                  severityNumber: emitted.severityNumber,
                  body: emitted.body,
                  attributes: emitted.attributes,
                });
              }
              resultCallback({ code: 0 });
            },
          );
          const stopped = vi
            .spyOn(exporterModule.OTLPLogExporter.prototype, "shutdown")
            .mockResolvedValue();
          const telemetry = yield* Effect.promise(() => import("@repo/ai-native-telemetry"));
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
          const commandTelemetry = yield* Effect.promise(() => import("./command-telemetry.ts"));
          commandTelemetry.recordCommandRecord({
            commandLine: MEASURED_COMMAND_LINE,
            exitCode: FAILING_EXIT_CODE,
            filePath: RECORD_PATH,
            bytes: RECORD_BYTES,
            lineCount: RECORD_LINES,
            excerpt: RECORD_EXCERPT,
          });
          process.emit("beforeExit", 0);
          yield* Effect.promise(() => vi.waitUntil(() => stopped.mock.calls.length > 0));
          return exported;
        }),
      ));

    it("carry the failure the record ended with", ({ recordsOfAFailingCommand }) => {
      expect(recordsOfAFailingCommand).toHaveBeenCalledExactlyOnceWith({
        eventName: "mst.command.record",
        severityNumber: SeverityNumber.ERROR,
        body: RECORD_EXCERPT,
        attributes: {
          "command.line": MEASURED_COMMAND_LINE,
          "command.record.path": RECORD_PATH,
          "command.record.bytes": RECORD_BYTES,
          "command.record.lines": RECORD_LINES,
          [ATTR_PROCESS_EXIT_CODE]: FAILING_EXIT_CODE,
        },
      });
    });
  });
});

describe("the package surface", () => {
  const it = test.extend("declaredManifest", () => packageManifest);

  it("is run and not imported", ({ declaredManifest }) => {
    expect(declaredManifest).toStrictEqual({
      name: "@repo/ai-native",
      version: "0.0.0",
      description:
        "Command wrappers that keep parallel heavy commands within the host's capacity and their output out of the caller's context window, plus Claude Code hooks that refuse sliced reads and instruct catching up a pull request that fell behind its base.",
      keywords: ["tanstack-intent"],
      license: "MIT",
      repository: {
        type: "git",
        url: "git+https://github.com/masseater/typescript-template.git",
        directory: "tools/ai-native",
      },
      bin: {
        spool: "./src/features/ai-native/spool/cli.ts",
        "sync-base": "./src/features/ai-native/sync-base/cli.ts",
        throttle: "./src/features/ai-native/throttle/cli.ts",
        unabridged: "./src/features/ai-native/unabridged/cli.ts",
      },
      files: ["dist", "skills"],
      type: "module",
      sideEffects: false,
      exports: { "./package.json": "./package.json" },
      publishConfig: {
        bin: {
          spool: "./dist/spool/cli.mjs",
          "sync-base": "./dist/sync-base/cli.mjs",
          throttle: "./dist/throttle/cli.mjs",
          unabridged: "./dist/unabridged/cli.mjs",
        },
        access: "public",
      },
      dependencies: {
        "@opentelemetry/api": "catalog:",
        "@opentelemetry/api-logs": "0.221.0",
        "@opentelemetry/semantic-conventions": "1.43.0",
        "@repo/ai-native-telemetry": "workspace:*",
        "cc-hooks-ts": "2.1.251",
        effect: "catalog:",
        "es-toolkit": "catalog:",
        "fs-native-extensions": "1.5.0",
        "shell-quote": "1.10.0",
      },
      devDependencies: {
        "@opentelemetry/exporter-logs-otlp-http": "0.221.0",
        "@opentelemetry/exporter-metrics-otlp-http": "catalog:",
        "@opentelemetry/exporter-trace-otlp-http": "0.221.0",
        "@opentelemetry/sdk-metrics": "catalog:",
        "@repo/dont-review-it": "workspace:*",
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
