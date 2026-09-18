import { Effect, Layer } from "effect";
import { Embedder, embedWith } from "./embedder.ts";
import type { AppServices } from "./index.ts";
import type { AuthFailure } from "@template/auth";
import type { ConfigurationInvalid } from "@template/config";
import type { TelemetryInvalid } from "@template/observability";
import { configuredAppLayer } from "./index.ts";
import { readWikiConfig } from "@template/config";

type WikiServices = AppServices | Embedder;

function wikiLayer(
  env: unknown,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<WikiServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> {
  return Layer.unwrap(
    readWikiConfig(env).pipe(
      Effect.map((config) => {
        const embedder = Embedder.of({
          available: config.AI !== undefined,
          embed: embedWith(config.AI),
        });
        return Layer.merge(
          Layer.succeed(Embedder, embedder),
          configuredAppLayer(config, "wiki", routes),
        );
      }),
    ),
  );
}

export { Embedder } from "./embedder.ts";
export { EmbeddingFailed } from "./embedding-failed.ts";
export { wikiLayer };
export type { WikiServices };
