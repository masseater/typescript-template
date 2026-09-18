import { Console, Logger, References, type Layer, type LogLevel } from "effect";

import { redactedField } from "./redact.ts";

import type { ServiceName } from "@repo/config";

export type LogSink = {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
  readonly warn: (line: string) => void;
};

export type StructuredLogOptions = {
  readonly serviceName: ServiceName;
  readonly release: string;
  readonly log?: LogSink;
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

export const isRecord = (candidate: unknown): candidate is Readonly<Record<string, unknown>> =>
  typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);

export const serviceLabel = (serviceName: ServiceName): string => `${serviceName}-server`;

const messageParts = (logged: unknown): readonly unknown[] =>
  Array.isArray(logged) ? logged : [logged];

export const redactedLogger = (
  logger: Logger.Logger<unknown, void>,
): Logger.Logger<unknown, void> =>
  Logger.make((logOptions) => {
    logger.log({
      ...logOptions,
      message: JSON.parse(JSON.stringify(messageParts(logOptions.message), redactedField)),
    });
  });

export const structuredLogs = (logOptions: StructuredLogOptions): Layer.Layer<never> => {
  const logger = Logger.make(({ fiber, logLevel, message: logged }) => {
    const sink = logOptions.log ?? fiber.getRef(Console.Console);
    const [eventName, attributes] = messageParts(logged);
    const line = JSON.stringify(
      {
        event: typeof eventName === "string" ? eventName : "application.log",
        release: logOptions.release,
        service: serviceLabel(logOptions.serviceName),
        ...fiber.getRef(References.CurrentLogAnnotations),
        ...(isRecord(attributes) ? attributes : {}),
      },
      redactedField,
    );
    sink[sinkByLevel[logLevel]](line);
  });
  return Logger.layer([logger]);
};
