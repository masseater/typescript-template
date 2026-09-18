import { Console, Logger, References } from "effect";
import type { Layer } from "effect";

import type { ServiceName } from "@repo/config";

import { redactedField } from "./redact.ts";

interface LogSink {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
}

interface StructuredLogOptions {
  readonly serviceName: ServiceName;
  readonly release: string;
  readonly log?: LogSink;
}

const failureLevels: ReadonlySet<string> = new Set(["Error", "Fatal", "Warn"]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function messageParts(message: unknown): readonly unknown[] {
  return Array.isArray(message) ? message : [message];
}

function serviceLabel(name: ServiceName): string {
  return `${name}-server`;
}

function redactedMessage(message: unknown): unknown {
  return JSON.parse(JSON.stringify(messageParts(message), redactedField));
}

function redactedLogger(logger: Logger.Logger<unknown, void>): Logger.Logger<unknown, void> {
  return Logger.make((options) => {
    logger.log({ ...options, message: redactedMessage(options.message) });
  });
}

function structuredLogs(options: StructuredLogOptions): Layer.Layer<never> {
  const logger = Logger.make(({ fiber, logLevel, message }) => {
    const sink = options.log ?? fiber.getRef(Console.Console);
    const [event, attributes] = messageParts(message);
    const line = JSON.stringify(
      {
        event: typeof event === "string" ? event : "application.log",
        release: options.release,
        service: serviceLabel(options.serviceName),
        ...fiber.getRef(References.CurrentLogAnnotations),
        ...(isRecord(attributes) ? attributes : {}),
      },
      redactedField,
    );
    sink[failureLevels.has(logLevel) ? "error" : "info"](line);
  });
  return Logger.layer([logger]);
}

export { isRecord, redactedLogger, serviceLabel, structuredLogs };
export type { LogSink, StructuredLogOptions };
