import { withSpan } from "@repo/observability";
import { Effect, Schema } from "effect";

class StorageFailed extends Schema.TaggedError<StorageFailed>()("StorageFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["unavailable", "operation_failed"]),
}) {}

const unavailable = Effect.fail(new StorageFailed({ reason: "unavailable" }));

const storageAttempt =
  (area: "cache" | "files") =>
  <Value>(operation: string, run: () => Promise<Value>): Effect.Effect<Value, StorageFailed> =>
    Effect.tryPromise({
      catch: (cause) => new StorageFailed({ cause, reason: "operation_failed" }),
      try: run,
    }).pipe(withSpan(`storage.${area}.${operation}`));

export { StorageFailed, storageAttempt, unavailable };
