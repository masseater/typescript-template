import { Schema, type Crypto, type Effect, type FileSystem, type Path } from "effect";

import type { ChildProcessSpawner } from "effect/unstable/process";

class JourneyFailure extends Schema.TaggedError<JourneyFailure>()("JourneyFailure", {
  detail: Schema.optionalKey(Schema.String),
  reason: Schema.String,
}) {}

type Journey<Success> = Effect.Effect<
  Success,
  JourneyFailure,
  ChildProcessSpawner.ChildProcessSpawner | Crypto.Crypto | FileSystem.FileSystem | Path.Path
>;

const spelled = (cause: unknown): string => {
  if (typeof cause === "string") {
    return cause;
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return "unknown";
};

const failed = (reason: string, cause?: unknown): JourneyFailure =>
  new JourneyFailure({
    ...(cause === undefined ? {} : { detail: spelled(cause) }),
    reason,
  });

export { JourneyFailure, failed, spelled };
export type { Journey };
