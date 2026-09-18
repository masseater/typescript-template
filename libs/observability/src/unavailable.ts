import { Cause, Console, Effect, Result } from "effect";
import { isSecretKey, redactSecrets, redactedValue } from "./redact.ts";
import type { Application } from "@template/config";
import type { LogSink } from "./structured-logs.ts";
import { failureAttributesOf } from "./request-span.ts";

interface Reporting {
  readonly service: Application;
  readonly log?: LogSink;
}

const summaryLength = 512;
const scanFactor = 4;
const scanLength = summaryLength * scanFactor;
const truncationMark = "…";
const unserializable = "[unserializable]";

function scanned(value: string): string {
  return redactSecrets(value.slice(0, scanLength));
}

function summarized(value: string, cut: boolean): string {
  return cut || value.length > summaryLength
    ? `${value.slice(0, summaryLength)}${truncationMark}`
    : value;
}

function bounded(value: string): string {
  return summarized(scanned(value), value.length > scanLength);
}

function loggableField(key: string, value: unknown): unknown {
  if (isSecretKey(key)) {
    return redactedValue;
  }
  if (key !== "" && value instanceof Error) {
    return { message: value.message, name: value.name };
  }
  return typeof value === "string" ? scanned(value) : value;
}

function errorFields(error: unknown): string {
  const encoded = Result.try(() => JSON.stringify(error, loggableField));
  return Result.isSuccess(encoded) ? summarized(encoded.success, false) : unserializable;
}

function unavailableLog(
  cause: Readonly<Cause.Cause<unknown>>,
  service: Application,
): Record<string, string> {
  const error = Cause.squash(cause);
  return {
    ...failureAttributesOf(error),
    "error.cause": bounded(Cause.pretty(cause)),
    "error.fields": errorFields(error),
    event: "application.runtime_unavailable",
    service: `${service}-server`,
  };
}

function reportUnavailable(
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<void> {
  return Effect.gen(function* reportUnavailableProgram() {
    const sink = reporting.log ?? (yield* Console.Console);
    sink.error(JSON.stringify(unavailableLog(cause, reporting.service)));
  });
}

export { reportUnavailable };
export type { Reporting };
