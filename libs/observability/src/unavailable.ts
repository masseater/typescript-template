import { Cause, Console, Effect, Result } from "effect";

import { redactSecrets, redactedField } from "./redact.ts";
import { failureAttributesOf } from "./request-span.ts";
import { isRecord, serviceLabel, type LogSink } from "./structured-logs.ts";

import type { ServiceName } from "@repo/config";

type Reporting = {
  readonly service: ServiceName;
  readonly log?: LogSink;
};

const summaryLength = 512;
const scanFactor = 4;
const scanLength = summaryLength * scanFactor;

const scanned = (logLine: string): string => redactSecrets(logLine.slice(0, scanLength));

const truncationMark = "…";

const summarized = (scannedLine: string, cut: boolean): string =>
  cut || scannedLine.length > summaryLength
    ? `${scannedLine.slice(0, summaryLength)}${truncationMark}`
    : scannedLine;

const bounded = (logLine: string): string =>
  summarized(scanned(logLine), logLine.length > scanLength);

const loggableField = (fieldName: string, fieldValue: unknown): unknown => {
  const field = redactedField(fieldName, fieldValue);
  return typeof field === "string" ? field.slice(0, scanLength) : field;
};

const unserializable = "[unserializable]";

const errorFields = (failed: unknown): string => {
  const encoded = Result.try(() => JSON.stringify(failed, loggableField));
  return Result.isSuccess(encoded) ? summarized(encoded.success, false) : unserializable;
};

const causeText = (failed: unknown): string | undefined => {
  if (failed instanceof Error) {
    return failed.message === "" ? undefined : `${failed.name}: ${failed.message}`;
  }
  if (!isRecord(failed)) {
    return undefined;
  }
  const { message } = failed;
  return typeof message === "string" && message !== "" ? message : undefined;
};

const nestedCause = (failed: unknown): unknown => {
  if (failed instanceof Error) {
    return failed.cause;
  }
  return typeof failed === "object" && failed !== null && "cause" in failed
    ? failed.cause
    : undefined;
};

const chainDepth = 8;
const chainDepths = [...Array.from({ length: chainDepth }).keys()];
const chainSeparator = " < ";

const causeChain = (failed: unknown): string => {
  const chained = chainDepths.reduce<{
    readonly link: unknown;
    readonly texts: readonly string[];
  }>(
    (chain) => {
      if (chain.link === undefined || chain.link === null) {
        return chain;
      }
      const described = causeText(chain.link);
      return {
        link: nestedCause(chain.link),
        texts: described === undefined ? chain.texts : [...chain.texts, scanned(described)],
      };
    },
    { link: failed, texts: [] },
  );
  return chained.texts.toReversed().join(chainSeparator);
};

const unavailableLog = (
  cause: Readonly<Cause.Cause<unknown>>,
  service: ServiceName,
): Record<string, string> => {
  const failed = Cause.squash(cause);
  return {
    ...failureAttributesOf(failed),
    "error.cause": bounded(Cause.pretty(cause)),
    "error.chain": bounded(causeChain(failed)),
    "error.fields": errorFields(failed),
    event: "application.runtime_unavailable",
    service: serviceLabel(service),
  };
};

const reportUnavailable = (
  cause: Readonly<Cause.Cause<unknown>>,
  reporting: Reporting,
): Effect.Effect<void> =>
  Effect.gen(function* reportUnavailableProgram() {
    const sink = reporting.log ?? (yield* Console.Console);
    sink.error(JSON.stringify(unavailableLog(cause, reporting.service)));
  });

export { reportUnavailable };
export type { Reporting };
