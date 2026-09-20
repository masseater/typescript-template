import { Cause, Console, Logger, References, type Layer, type LogLevel } from "effect";

import { redactSecrets, redactedField } from "./redact.ts";

import type { ServiceName } from "@repo/config";

const messageParts = (logged: unknown): readonly unknown[] =>
  Array.isArray(logged) ? logged : [logged];

const isRecord = (candidate: unknown): candidate is Readonly<Record<string, unknown>> =>
  typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);

const causeField = (cause: Readonly<Cause.Cause<unknown>>): Readonly<Record<string, string>> =>
  cause.reasons.length === 0 ? {} : { "error.cause": redactSecrets(Cause.pretty(cause)) };

const withCause = (logged: unknown, cause: Readonly<Cause.Cause<unknown>>): unknown => {
  const reported = causeField(cause);
  if (Object.keys(reported).length === 0) {
    return logged;
  }
  const [eventName, attributes] = messageParts(logged);
  return [eventName, { ...(isRecord(attributes) ? attributes : {}), ...reported }];
};

export const redactedLogger = (
  logger: Logger.Logger<unknown, void>,
): Logger.Logger<unknown, void> =>
  Logger.make((logOptions) => {
    logger.log({
      ...logOptions,
      cause: Cause.empty,
      message: JSON.parse(
        JSON.stringify(withCause(logOptions.message, logOptions.cause), redactedField),
      ),
    });
  });

export { isRecord };

export const serviceLabel = (serviceName: ServiceName): string => `${serviceName}-server`;

export type LogSink = {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
  readonly warn: (line: string) => void;
};

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

export type StructuredLogOptions = {
  readonly serviceName: ServiceName;
  readonly release: string;
  readonly log?: LogSink;
};

export const structuredLogs = (logOptions: StructuredLogOptions): Layer.Layer<never> => {
  const logger = Logger.make(({ cause, fiber, logLevel, message: logged }) => {
    const sink = logOptions.log ?? fiber.getRef(Console.Console);
    const [eventName, attributes] = messageParts(logged);
    const line = JSON.stringify(
      {
        event: typeof eventName === "string" ? eventName : "application.log",
        release: logOptions.release,
        service: serviceLabel(logOptions.serviceName),
        ...fiber.getRef(References.CurrentLogAnnotations),
        ...(isRecord(attributes) ? attributes : {}),
        ...causeField(cause),
      },
      redactedField,
    );
    sink[sinkByLevel[logLevel]](line);
  });
  return Logger.layer([logger]);
};
