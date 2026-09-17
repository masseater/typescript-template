import { readWikiConfig } from "@template/config";
import { Telemetry } from "@template/observability";
import { Context, Effect, Layer, Schema } from "effect";
import { AppOrigin, Assets } from "./http.ts";

const embeddingModel = "@cf/baai/bge-m3";
const embeddingBatch = 32;
const EmbeddingOutput = Schema.Struct({ data: Schema.Array(Schema.Array(Schema.Finite)) });

export class EmbeddingFailed extends Schema.TaggedError<EmbeddingFailed>()("EmbeddingFailed", {
  reason: Schema.Literals(["unavailable", "invalid_output", "count_mismatch"]),
}) {}

export class Embedder extends Context.Service<
  Embedder,
  {
    readonly available: boolean;
    readonly embed: (
      texts: readonly string[],
    ) => Effect.Effect<readonly (readonly number[])[], EmbeddingFailed>;
  }
>()("@template/runtime/Embedder") {}

export type WikiServices = Layer.Success<ReturnType<typeof wikiLayer>>;

export const wikiLayer = (env: unknown, routes: Readonly<Record<string, string>>) =>
  Layer.unwrap(
    readWikiConfig(env).pipe(
      Effect.map((config) => {
        const ai = config.AI;
        const embed = Effect.fn("embed")(function* (texts: readonly string[]) {
          if (ai === undefined) return yield* new EmbeddingFailed({ reason: "unavailable" });
          const vectors: (readonly number[])[] = [];
          for (let start = 0; start < texts.length; start += embeddingBatch) {
            const text = texts.slice(start, start + embeddingBatch);
            const output = yield* Effect.tryPromise({
              try: () => ai.run(embeddingModel, { text }),
              catch: () => new EmbeddingFailed({ reason: "unavailable" }),
            });
            const { data } = yield* Schema.decodeUnknownEffect(EmbeddingOutput)(output).pipe(
              Effect.mapError(() => new EmbeddingFailed({ reason: "invalid_output" })),
            );
            if (data.length !== text.length)
              return yield* new EmbeddingFailed({ reason: "count_mismatch" });
            vectors.push(...data);
          }
          return vectors;
        });
        return Layer.mergeAll(
          Layer.succeed(Embedder, Embedder.of({ available: ai !== undefined, embed })),
          Layer.succeed(AppOrigin, config.APP_ORIGIN),
          Layer.succeed(Assets, config.ASSETS),
        ).pipe(
          Layer.provideMerge(
            Telemetry.layer({ serviceName: "wiki", release: config.APP_RELEASE, routes }),
          ),
        );
      }),
    ),
  );
