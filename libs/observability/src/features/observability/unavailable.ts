import { Cause, Console, Effect, Predicate, Result, Schema } from "effect";

import { appliedField, redactSecrets, redactedField } from "./redact.ts";
import { failureAttributesOf } from "./request-span.ts";
import { serviceLabel } from "./structured-logs.ts";

import type { ServiceName } from "./service-name.ts";
import type { LogSink } from "./structured-logs.ts";

interface Reporting {
  readonly service: ServiceName;
  readonly log?: LogSink;
}

const summaryLength = 512;
const scanFactor = 4;
const scanLength = summaryLength * scanFactor;
const chainDepth = 8;
const chainSeparator = " < ";
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
  const field = redactedField(key, value);
  return typeof field === "string" ? field.slice(0, scanLength) : field;
}

function errorFields(error: unknown): string {
  const encoded = Result.try(() =>
    Effect.runSync(
      Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
        appliedField(error, loggableField),
      ),
    ),
  );
  return Result.isSuccess(encoded) ? summarized(encoded.success, false) : unserializable;
}

function causeText(value: unknown): string | undefined {
  if (value instanceof Error) {
    return value.message === "" ? undefined : `${value.name}: ${value.message}`;
  }
  if (!Predicate.isObject(value)) {
    return undefined;
  }
  const { message } = value;
  return typeof message === "string" && message !== "" ? message : undefined;
}

function nestedCause(value: unknown): unknown {
  if (value instanceof Error) {
    return value.cause;
  }
  return Predicate.isObject(value) ? value["cause"] : undefined;
}

function causeChain(error: unknown): string {
  const links: string[] = [];
  let current = error;
  for (let depth = 0; depth < chainDepth && current !== undefined && current !== null; depth += 1) {
    const text = causeText(current);
    if (text !== undefined) {
      links.push(scanned(text));
    }
    current = nestedCause(current);
  }
  return links.toReversed().join(chainSeparator);
}

function unavailableLog(
  cause: Readonly<Cause.Cause<unknown>>,
  service: ServiceName,
): Record<string, string> {
  const error = Cause.squash(cause);
  return {
    ...failureAttributesOf(error),
    "error.cause": bounded(Cause.pretty(cause)),
    "error.chain": bounded(causeChain(error)),
    "error.fields": errorFields(error),
    event: "application.runtime_unavailable",
    service: serviceLabel(service),
  };
}

function reportUnavailable(
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<void> {
  return Effect.gen(function* reportUnavailableProgram() {
    const sink = reporting.log ?? (yield* Console.Console);
    sink.error(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
        unavailableLog(cause, reporting.service),
      ).pipe(Effect.orDie),
    );
  });
}

export { reportUnavailable };
export type { Reporting };
