import { Console, Logger, References, type Layer } from "effect";

import type { Application } from "@repo/config";

export type LogSink = {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
};

export type StructuredLogOptions = {
  readonly serviceName: Application;
  readonly release: string;
  readonly log?: LogSink;
};

const failureLevels: ReadonlySet<string> = new Set(["Error", "Fatal", "Warn"]);

export const isRecord = (candidate: unknown): candidate is Readonly<Record<string, unknown>> => {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
};

export const serviceLabel = (serviceName: Application): string => `${serviceName}-server`;

export const structuredLogs = (logOptions: StructuredLogOptions): Layer.Layer<never> => {
  const logger = Logger.make(({ fiber, logLevel, message: logged }) => {
    const sink = logOptions.log ?? fiber.getRef(Console.Console);
    const logParts: readonly unknown[] = Array.isArray(logged) ? logged : [logged];
    const [eventName, attributes] = logParts;
    const line = JSON.stringify({
      event: typeof eventName === "string" ? eventName : "application.log",
      release: logOptions.release,
      service: serviceLabel(logOptions.serviceName),
      ...fiber.getRef(References.CurrentLogAnnotations),
      ...(isRecord(attributes) ? attributes : {}),
    });
    if (failureLevels.has(logLevel)) {
      sink.error(line);
      return;
    }
    sink.info(line);
  });
  return Logger.layer([logger]);
};
