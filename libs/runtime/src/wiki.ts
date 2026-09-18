import { readWikiConfig, type ConfigurationInvalid } from "@template/config";
import { Effect, Layer } from "effect";

import { Embedder, embedWith } from "./embedder.ts";
import { configuredAppLayer, type AppServices } from "./index.ts";

import type { AuthFailure } from "@template/auth";
import type { TelemetryInvalid } from "@template/observability";

type WikiServices = AppServices | Embedder;

export { Embedder } from "./embedder.ts";
export { EmbeddingFailed } from "./embedding-failed.ts";
const wikiLayer = (
  env: unknown,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<WikiServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> => {
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
};

export { wikiLayer };
export type { WikiServices };
