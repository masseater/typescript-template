import { Cause, Effect, Option, Predicate, Schema } from "effect";
import { ConfigProvider, fromDotEnvContents } from "effect/ConfigProvider";

const FAILED_EXIT_CODE = 1;

const FailureKeys = Schema.Array(Schema.String);
const isCoded = Schema.is(
  Schema.Struct({ code: Schema.String, keys: Schema.optional(FailureKeys) }),
);

function withVerifiedSecrets<Value, Failure, Requirements>(
  secrets: Readonly<{ contents: string }>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  program: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<Value, Failure, Requirements> {
  return Effect.provideService(program, ConfigProvider, fromDotEnvContents(secrets.contents));
}

function describeFailure(failure: unknown): Readonly<Record<string, unknown>> {
  if (isCoded(failure)) {
    return {
      code: failure.code,
      ...(failure.keys === undefined ? {} : { keys: [...failure.keys] }),
    };
  }
  const reason: unknown = Predicate.hasProperty(failure, "message") ? failure.message : undefined;
  return typeof reason === "string" ? { reason } : { code: "unknown_failure" };
}

function reportCause(
  event: string,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  cause: Cause.Cause<unknown>,
): Effect.Effect<void> {
  return Effect.sync(() => {
    const failure = Option.getOrUndefined(Cause.findErrorOption(cause));
    // oxlint-disable-next-line no-console
    console.error(JSON.stringify({ event, ...describeFailure(failure) }));
    process.exitCode = FAILED_EXIT_CODE;
  });
}

export { describeFailure, reportCause, withVerifiedSecrets };
