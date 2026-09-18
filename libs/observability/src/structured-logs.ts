import { Logger, References } from "effect";
import type { Application } from "@template/config";
import type { Layer } from "effect";
import type { LogSink } from "./log.ts";
import { consoleSink } from "./log.ts";

interface StructuredLogOptions {
  readonly serviceName: Application;
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

function structuredLogs(options: StructuredLogOptions): Layer.Layer<never> {
  const sink = options.log ?? consoleSink;
  const logger = Logger.make(({ fiber, logLevel, message }) => {
    const [event, attributes] = messageParts(message);
    const line = JSON.stringify({
      event: typeof event === "string" ? event : "application.log",
      release: options.release,
      service: `${options.serviceName}-server`,
      ...fiber.getRef(References.CurrentLogAnnotations),
      ...(isRecord(attributes) ? attributes : {}),
    });
    sink[failureLevels.has(logLevel) ? "error" : "info"](line);
  });
  return Logger.layer([logger]);
}

export { isRecord, structuredLogs };
export type { StructuredLogOptions };
