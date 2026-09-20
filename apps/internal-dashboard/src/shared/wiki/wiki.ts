import { APPLICATION, readWikiConfig } from "@repo/config";
import { configuredAppLayer } from "@repo/runtime";
import { Effect, Layer } from "effect";

import { Embedder, embedWith } from "./embedder.ts";

import type { AuthFailure } from "@repo/auth";
import type { ConfigurationInvalid } from "@repo/config";
import type { TelemetryInvalid } from "@repo/observability";
import type { AppServices } from "@repo/runtime";

const wikiService = APPLICATION.wiki;

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
          configuredAppLayer(config, wikiService, routes),
        );
      }),
    ),
  );
}

export { Embedder } from "./embedder.ts";
export { EmbeddingFailed } from "./embedding-failed.ts";
export { wikiLayer, wikiService };
export type { WikiServices };
