import { Console, Logger, References } from "effect";
import type { Application } from "@repo/config";
import type { Layer } from "effect";

interface LogSink {
  readonly error: (line: string) => void;
  readonly info: (line: string) => void;
}

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

function serviceLabel(name: Application): string {
  return `${name}-server`;
}

function structuredLogs(options: StructuredLogOptions): Layer.Layer<never> {
  const logger = Logger.make(({ fiber, logLevel, message }) => {
    const sink = options.log ?? fiber.getRef(Console.Console);
    const [event, attributes] = messageParts(message);
    const line = JSON.stringify({
      event: typeof event === "string" ? event : "application.log",
      release: options.release,
      service: serviceLabel(options.serviceName),
      ...fiber.getRef(References.CurrentLogAnnotations),
      ...(isRecord(attributes) ? attributes : {}),
    });
    sink[failureLevels.has(logLevel) ? "error" : "info"](line);
  });
  return Logger.layer([logger]);
}

export { isRecord, serviceLabel, structuredLogs };
export type { LogSink, StructuredLogOptions };
