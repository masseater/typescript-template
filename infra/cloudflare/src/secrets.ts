import { Cause, Effect, Option } from "effect";
import { ConfigProvider, fromDotEnvContents } from "effect/ConfigProvider";

const FAILED_EXIT_CODE = 1;

function withVerifiedSecrets<Value, Failure, Requirements>(
  secrets: Readonly<{ contents: string }>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  program: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<Value, Failure, Requirements> {
  return Effect.provideService(program, ConfigProvider, fromDotEnvContents(secrets.contents));
}

function describeFailure(failure: unknown): Readonly<Record<string, unknown>> {
  if (typeof failure !== "object" || failure === null) {
    return { code: "unknown_failure" };
  }
  const code: unknown = Reflect.get(failure, "code");
  const keys: unknown = Reflect.get(failure, "keys");
  const reason: unknown = Reflect.get(failure, "message");
  return {
    ...(typeof code === "string" ? { code } : {}),
    ...(Array.isArray(keys) ? { keys: keys.map(String) } : {}),
    ...(typeof code === "string" || typeof reason !== "string" ? {} : { reason }),
  };
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

function reportRejection(event: string, failure: unknown): Effect.Effect<void> {
  return Effect.sync(() => {
    // oxlint-disable-next-line no-console
    console.error(JSON.stringify({ event, ...describeFailure(failure) }));
    process.exitCode = FAILED_EXIT_CODE;
  });
}

export { describeFailure, reportCause, reportRejection, withVerifiedSecrets };
