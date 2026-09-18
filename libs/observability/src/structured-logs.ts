import { Logger, References, type Layer } from "effect";

import { consoleSink, type LogSink } from "./log.ts";

import type { Application } from "@template/config";

export type StructuredLogOptions = {
  readonly serviceName: Application;
  readonly release: string;
  readonly log?: LogSink;
};

const failureLevels: ReadonlySet<string> = new Set(["Error", "Fatal", "Warn"]);

export const isRecord = (candidate: unknown): candidate is Readonly<Record<string, unknown>> => {
  return typeof candidate === "object" && candidate !== null && !Array.isArray(candidate);
};

export const structuredLogs = (logOptions: StructuredLogOptions): Layer.Layer<never> => {
  const sink = logOptions.log ?? consoleSink;
  const logger = Logger.make(({ fiber, logLevel, message: logged }) => {
    const logParts: readonly unknown[] = Array.isArray(logged) ? logged : [logged];
    const [eventName, attributes] = logParts;
    const line = JSON.stringify({
      event: typeof eventName === "string" ? eventName : "application.log",
      release: logOptions.release,
      service: `${logOptions.serviceName}-server`,
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
