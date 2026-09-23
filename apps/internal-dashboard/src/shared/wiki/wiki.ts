import { APPLICATION, ConfigurationInvalid } from "@repo/config";
import { allowAllEditors, configuredFeatureFlagsLayer } from "@repo/feature-flags";
import { configuredAppLayer } from "@repo/runtime";
import { readWorkerConfig } from "@repo/runtime/bindings";
import { Effect, Layer } from "effect";

import { Embedder, embedWith } from "./embedder.ts";

import type { AuthFailure } from "@repo/auth";
import type { FeatureFlags, FlagEditorAccess } from "@repo/feature-flags";
import type { TelemetryInvalid } from "@repo/observability";
import type { AppServices } from "@repo/runtime";

const wikiService = APPLICATION.wiki;

type WikiServices = AppServices | Embedder | FeatureFlags | FlagEditorAccess;

function wikiLayer(
  env: unknown,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<WikiServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> {
  return Layer.unwrap(
    readWorkerConfig(env).pipe(
      Effect.flatMap((config) =>
        Effect.gen(function* wikiServices() {
          const embedder = Embedder.of({
            available: config.AI !== undefined,
            embed: embedWith(config.AI),
          });
          const flags = yield* configuredFeatureFlagsLayer(config);
          return Layer.mergeAll(
            Layer.succeed(Embedder, embedder),
            configuredAppLayer(config, wikiService, routes),
            flags,
            allowAllEditors,
          );
        }),
      ),
    ),
  );
}

export { wikiLayer, wikiService };
export type { WikiServices };
