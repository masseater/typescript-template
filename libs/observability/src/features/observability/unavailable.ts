import { Cause, Console, Effect, Predicate, Result } from "effect";

import { redactSecrets, redactedField } from "./redact.ts";
import { failureAttributesOf } from "./request-span.ts";
import { serviceLabel, type LogSink } from "./structured-logs.ts";

import type { ServiceName } from "./service-name.ts";

type Reporting = {
  readonly service: ServiceName;
  readonly log?: LogSink;
};

const summaryLength = 512;
const scanFactor = 4;

const scanned = (decoded: string): string => {
  const scanLength = summaryLength * scanFactor;
  return redactSecrets(decoded.slice(0, scanLength));
};

const summarized = (decoded: string, cut: boolean): string => {
  const truncationMark = "…";
  return cut || decoded.length > summaryLength
    ? `${decoded.slice(0, summaryLength)}${truncationMark}`
    : decoded;
};

const bounded = (decoded: string): string => {
  const scanLength = summaryLength * scanFactor;
  return summarized(scanned(decoded), decoded.length > scanLength);
};

const loggableField = (fieldName: string, decoded: unknown): unknown => {
  const scanLength = summaryLength * scanFactor;
  const field = redactedField(fieldName, decoded);
  return typeof field === "string" ? field.slice(0, scanLength) : field;
};

const errorFields = (caughtError: unknown): string => {
  const unserializable = "[unserializable]";
  const encoded = Result.try(() => JSON.stringify(caughtError, loggableField));
  return Result.isSuccess(encoded) ? summarized(encoded.success, false) : unserializable;
};

const causeText = (decoded: unknown): string | undefined => {
  if (decoded instanceof Error) {
    return decoded.message === "" ? undefined : `${decoded.name}: ${decoded.message}`;
  }
  if (!Predicate.isObject(decoded)) {
    return undefined;
  }
  const { message } = decoded;
  return typeof message === "string" && message !== "" ? message : undefined;
};

const nestedCause = (decoded: unknown): unknown => {
  if (decoded instanceof Error) {
    return decoded.cause;
  }
  return Predicate.isObject(decoded) ? decoded["cause"] : undefined;
};

const causeChain = (caughtError: unknown): string => {
  const chainSeparator = " < ";
  const chainDepth = 8;
  const collect = (node: unknown, depth: number): readonly string[] => {
    if (depth >= chainDepth || node === undefined || node === null) {
      return [];
    }
    const excerpt = causeText(node);
    const deeper = collect(nestedCause(node), depth + 1);
    return excerpt === undefined ? deeper : [...deeper, scanned(excerpt)];
  };
  return collect(caughtError, 0).join(chainSeparator);
};

const unavailableLog = (
  cause: Readonly<Cause.Cause<unknown>>,
  service: ServiceName,
): Record<string, string> => {
  const caughtError = Cause.squash(cause);
  return {
    ...failureAttributesOf(caughtError),
    "error.cause": bounded(Cause.pretty(cause)),
    "error.chain": bounded(causeChain(caughtError)),
    "error.fields": errorFields(caughtError),
    event: "application.runtime_unavailable",
    service: serviceLabel(service),
  };
};

const reportUnavailable = (
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<void> => {
  return Effect.gen(function* reportUnavailableProgram() {
    const sink = reporting.log ?? (yield* Console.Console);
    sink.error(JSON.stringify(unavailableLog(cause, reporting.service)));
  });
};

export { reportUnavailable };
export type { Reporting };
