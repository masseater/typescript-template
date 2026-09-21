import { context, metrics, SpanStatusCode, trace, type Span } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import {
  ATTR_PROCESS_COMMAND_ARGS,
  ATTR_PROCESS_EXECUTABLE_NAME,
  ATTR_PROCESS_EXIT_CODE,
} from "@opentelemetry/semantic-conventions/incubating";
import {
  environmentCarryingContext,
  inheritedContext,
  startTelemetry,
} from "@repo/ai-native-telemetry";
import { Effect } from "effect";
import { once } from "es-toolkit";

import type { Command } from "../spool/parse-command.ts";

const INSTRUMENTATION_NAME = "@repo/ai-native";

const commandDuration = once(() =>
  metrics.getMeter(INSTRUMENTATION_NAME).createHistogram("command.duration", {
    description: "Time a wrapped command took from spawn to exit",
    unit: "ms",
  }),
);

const SERVICE_NAME = "mst-command";

const instrumented = (): boolean => startTelemetry(SERVICE_NAME).enabled;

export const childEnvironment = (): NodeJS.ProcessEnv | undefined =>
  instrumented() ? environmentCarryingContext() : undefined;

const measureSpan = (input: {
  readonly command: Command;
  readonly run: () => Promise<number>;
  readonly span: Span;
}): Promise<number> =>
  Effect.runPromise(
    Effect.gen(function* measureActiveSpan() {
      const startedAt = performance.now();
      input.span.setAttributes({
        [ATTR_PROCESS_EXECUTABLE_NAME]: input.command[0],
        [ATTR_PROCESS_COMMAND_ARGS]: [...input.command],
      });
      const exitCode = yield* Effect.promise(() => input.run());
      commandDuration().record(performance.now() - startedAt, {
        [ATTR_PROCESS_EXECUTABLE_NAME]: input.command[0],
        [ATTR_PROCESS_EXIT_CODE]: exitCode,
      });
      input.span.setAttribute(ATTR_PROCESS_EXIT_CODE, exitCode);
      if (exitCode !== 0) {
        input.span.setStatus({ code: SpanStatusCode.ERROR });
      }
      input.span.end();
      return exitCode;
    }),
  );

const recordSpan = (input: {
  readonly command: Command;
  readonly run: () => Promise<number>;
}): Promise<number> =>
  context.with(inheritedContext(), () =>
    trace
      .getTracer(INSTRUMENTATION_NAME)
      .startActiveSpan(input.command.join(" "), (span) =>
        measureSpan({ command: input.command, run: input.run, span }),
      ),
  );

export const measureCommand = (input: {
  readonly command: Command;
  readonly run: () => Promise<number>;
}): Promise<number> => (instrumented() ? recordSpan(input) : input.run());

export const recordCommandRecord = (input: {
  readonly commandLine: string;
  readonly exitCode: number;
  readonly filePath: string;
  readonly bytes: number;
  readonly lineCount: number;
  readonly excerpt: string;
}): void => {
  if (!instrumented()) {
    return;
  }
  logs.getLogger(INSTRUMENTATION_NAME).emit({
    eventName: "mst.command.record",
    severityNumber: input.exitCode === 0 ? SeverityNumber.INFO : SeverityNumber.ERROR,
    body: input.excerpt,
    attributes: {
      "command.line": input.commandLine,
      "command.record.path": input.filePath,
      "command.record.bytes": input.bytes,
      "command.record.lines": input.lineCount,
      [ATTR_PROCESS_EXIT_CODE]: input.exitCode,
    },
  });
};
