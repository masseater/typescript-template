import type { Ai } from "@cloudflare/workers-types";
import { Context, Effect, Schema } from "effect";

import { EmbeddingFailed } from "./embedding-failed.ts";

interface EmbedderShape {
  readonly available: boolean;
  readonly embed: (
    texts: readonly string[],
  ) => Effect.Effect<readonly (readonly number[])[], EmbeddingFailed>;
}

const embeddingModel = "@cf/baai/bge-m3";
const embeddingBatch = 32;
const EmbeddingOutput = Schema.Struct({ data: Schema.Array(Schema.Array(Schema.Finite)) });
const decodeOutput = Schema.decodeUnknownEffect(EmbeddingOutput);

const embedBatch = Effect.fn("embedBatch")(function* embedBatch(ai: Ai, text: readonly string[]) {
  const output = yield* Effect.tryPromise({
    catch: () => new EmbeddingFailed({ reason: "unavailable" }),
    try: async () => ai.run(embeddingModel, { text: [...text] }),
  });
  const { data } = yield* decodeOutput(output).pipe(
    Effect.mapError(() => new EmbeddingFailed({ reason: "invalid_output" })),
  );
  if (data.length !== text.length) {
    return yield* new EmbeddingFailed({ reason: "count_mismatch" });
  }
  return data;
});

function batches(texts: readonly string[]): readonly (readonly string[])[] {
  return Array.from({ length: Math.ceil(texts.length / embeddingBatch) }, (_unused, index) =>
    texts.slice(index * embeddingBatch, (index + 1) * embeddingBatch),
  );
}

function embedWith(ai: Ai | undefined): EmbedderShape["embed"] {
  return (texts) =>
    ai === undefined
      ? Effect.fail(new EmbeddingFailed({ reason: "unavailable" }))
      : Effect.forEach(batches(texts), (text) => embedBatch(ai, text)).pipe(
          Effect.map((vectors) => vectors.flat()),
        );
}

class Embedder extends Context.Service<Embedder, EmbedderShape>()("@repo/runtime/Embedder") {}

export { Embedder, embedWith };
