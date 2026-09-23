import { Cause, Console, Logger, Predicate, References, type Layer, type LogLevel } from "effect";

import { redactSecrets, redactedField } from "./redact.ts";

import type { ServiceName } from "./service-name.ts";
type LogSink = {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
  readonly warn: (line: string) => void;
};
type StructuredLogOptions = {
  readonly serviceName: ServiceName;
  readonly release: string;
  readonly log?: LogSink;
};
const messageParts = (logMessage: unknown): readonly unknown[] => {
  return Array.isArray(logMessage) ? logMessage : [logMessage];
};
const redactedMessage = (logMessage: unknown): unknown => {
  return JSON.parse(JSON.stringify(messageParts(logMessage), redactedField));
};
const causeField = (cause: Readonly<Cause.Cause<unknown>>): Readonly<Record<string, string>> => {
  return cause.reasons.length === 0 ? {} : { "error.cause": redactSecrets(Cause.pretty(cause)) };
};
const withCause = (logMessage: unknown, cause: Readonly<Cause.Cause<unknown>>): unknown => {
  const reported = causeField(cause);
  if (Object.keys(reported).length === 0) {
    return logMessage;
  }
  const [logEvent, attributes] = messageParts(logMessage);
  return [logEvent, { ...(Predicate.isObject(attributes) ? attributes : {}), ...reported }];
};
const redactedLogger = (logger: Logger.Logger<unknown, void>): Logger.Logger<unknown, void> => {
  return Logger.make((settings) => {
    logger.log({
      ...settings,
      cause: Cause.empty,
      message: redactedMessage(withCause(settings.message, settings.cause)),
    });
  });
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
const serviceLabel = (spelled: ServiceName): string => {
  return `${spelled}-server`;
};
const structuredLogs = (settings: StructuredLogOptions): Layer.Layer<never> => {
  const logger = Logger.make(({ cause, fiber, logLevel, message }) => {
    const sink = settings.log ?? fiber.getRef(Console.Console);
    const [logEvent, attributes] = messageParts(message);
    const line = JSON.stringify(
      {
        event: typeof logEvent === "string" ? logEvent : "application.log",
        release: settings.release,
        service: serviceLabel(settings.serviceName),
        ...fiber.getRef(References.CurrentLogAnnotations),
        ...(Predicate.isObject(attributes) ? attributes : {}),
        ...causeField(cause),
      },
      redactedField,
    );
    sink[sinkByLevel[logLevel]](line);
  });
  return Logger.layer([logger]);
};
export { redactedLogger, serviceLabel, structuredLogs };
export type { LogSink, StructuredLogOptions };
