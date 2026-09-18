import { Cause, Effect, Option, Predicate, Schema } from "effect";
import { ConfigProvider, fromDotEnvContents } from "effect/ConfigProvider";

import { reportFailed } from "@repo/config/cli";

const OK_EXIT_CODE = 0;
const FAILED_EXIT_CODE = 1;

const FailureKeys = Schema.Array(Schema.String);
const isCoded = Schema.is(
  Schema.Struct({ code: Schema.String, keys: Schema.optional(FailureKeys) }),
);

interface Confidential {
  readonly key: string;
  readonly value: string;
}

function withVerifiedSecrets<Value, Failure, Requirements>(
  secrets: Readonly<{ contents: string }>,
  program: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<Value, Failure, Requirements> {
  return Effect.provideService(program, ConfigProvider, fromDotEnvContents(secrets.contents));
}

function redact(text: string, confidential: readonly Confidential[]): string {
  let masked = text;
  for (const { key, value } of confidential) {
    if (value !== "") {
      masked = masked.replaceAll(value, `<redacted:${key}>`);
    }
  }
  return masked;
}

function describeFailure(
  failure: unknown,
  confidential: readonly Confidential[],
): Readonly<Record<string, unknown>> {
  if (isCoded(failure)) {
    return {
      code: failure.code,
      ...(failure.keys === undefined ? {} : { keys: [...failure.keys] }),
    };
  }
  const reason: unknown = Predicate.hasProperty(failure, "message") ? failure.message : undefined;
  return typeof reason === "string"
    ? { reason: redact(reason, confidential) }
    : { code: "unknown_failure" };
}

function describeCause(
  cause: Cause.Cause<unknown>,
  confidential: readonly Confidential[],
): Readonly<Record<string, unknown>> {
  const failure = Option.getOrUndefined(Cause.findErrorOption(cause));
  if (failure !== undefined) {
    return describeFailure(failure, confidential);
  }
  const defect = cause.reasons.find(Cause.isDieReason)?.defect;
  if (defect === undefined) {
    return { code: "unknown_failure" };
  }
  const described = describeFailure(defect, confidential);
  const counted = cause.reasons.length > 1 ? { reasons: cause.reasons.length } : {};
  return "code" in described
    ? { ...described, ...counted, defect: true }
    : { code: "defect", ...counted, ...described };
}

function reportCause(
  event: string,
  cause: Cause.Cause<unknown>,
  confidential: readonly Confidential[] = [],
): Effect.Effect<void> {
  return reportFailed({ event, ...describeCause(cause, confidential) });
}

export {
  FAILED_EXIT_CODE,
  OK_EXIT_CODE,
  describeCause,
  describeFailure,
  redact,
  reportCause,
  withVerifiedSecrets,
};
export type { Confidential };
