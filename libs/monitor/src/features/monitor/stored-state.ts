import { Effect, Schema } from "effect";

import type { DurableObjectStorage } from "@cloudflare/workers-types";

class StoredStateInvalid extends Schema.TaggedError<StoredStateInvalid>()("StoredStateInvalid", {
  code: Schema.Literal("stored_state_invalid"),
  keys: Schema.Array(Schema.String),
}) {}

const storedState = <Stored>(asked: {
  readonly storage: DurableObjectStorage;
  readonly key: string;
  readonly schema: Schema.Codec<Stored, unknown>;
  readonly initial: Stored;
}): Effect.Effect<Stored, StoredStateInvalid> =>
  Effect.promise((): Promise<unknown> => asked.storage.get(asked.key)).pipe(
    Effect.flatMap((stored) =>
      stored === undefined
        ? Effect.succeed(asked.initial)
        : Schema.decodeUnknownEffect(asked.schema)(stored).pipe(
            Effect.mapError(
              () => new StoredStateInvalid({ code: "stored_state_invalid", keys: [asked.key] }),
            ),
          ),
    ),
  );

export { StoredStateInvalid, storedState };
