import { Cause, Console, Logger, References } from "effect";

import { redactSecrets, redactedField } from "./redact.ts";

import type { Layer, LogLevel } from "effect";
import type { ServiceName } from "./service-name.ts";

interface LogSink {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
  readonly warn: (line: string) => void;
}

interface StructuredLogOptions {
  readonly serviceName: ServiceName;
  readonly release: string;
  readonly log?: LogSink;
}

const sinkByLevel: Readonly<Record<LogLevel.LogLevel, keyof LogSink>> = {
  All: "info",
  Debug: "info",
  Error: "error",
  Fatal: "error",
  Info: "info",
  None: "info",
  Trace: "info",
  Warn: "warn",
};

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

function causeField(cause: Readonly<Cause.Cause<unknown>>): Readonly<Record<string, string>> {
  return cause.reasons.length === 0 ? {} : { "error.cause": redactSecrets(Cause.pretty(cause)) };
}

function withCause(message: unknown, cause: Readonly<Cause.Cause<unknown>>): unknown {
  const reported = causeField(cause);
  if (Object.keys(reported).length === 0) {
    return message;
  }
  const [event, attributes] = messageParts(message);
  return [event, { ...(isRecord(attributes) ? attributes : {}), ...reported }];
}

function redactedLogger(logger: Logger.Logger<unknown, void>): Logger.Logger<unknown, void> {
  return Logger.make((options) => {
    logger.log({
      ...options,
      cause: Cause.empty,
      message: redactedMessage(withCause(options.message, options.cause)),
    });
  });
}

function structuredLogs(options: StructuredLogOptions): Layer.Layer<never> {
  const logger = Logger.make(({ cause, fiber, logLevel, message }) => {
    const sink = options.log ?? fiber.getRef(Console.Console);
    const [event, attributes] = messageParts(message);
    const line = JSON.stringify(
      {
        event: typeof event === "string" ? event : "application.log",
        release: options.release,
        service: serviceLabel(options.serviceName),
        ...fiber.getRef(References.CurrentLogAnnotations),
        ...(isRecord(attributes) ? attributes : {}),
        ...causeField(cause),
      },
      redactedField,
    );
    sink[sinkByLevel[logLevel]](line);
  });
  return Logger.layer([logger]);
}

export { isRecord, redactedLogger, serviceLabel, structuredLogs };
export type { LogSink, StructuredLogOptions };
