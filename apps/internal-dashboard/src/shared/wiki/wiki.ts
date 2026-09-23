import { APPLICATION } from "@repo/config";
import {
  allowAllEditors,
  flagshipFeatureFlagsLayer,
  memoryFeatureFlagsLayer,
} from "@repo/feature-flags";
import { configuredAppLayer } from "@repo/runtime";
import { readWorkerConfig } from "@repo/runtime/bindings";
import { Effect, Layer } from "effect";

import type { AuthFailure } from "@repo/auth";
import type { AppConfig, ConfigurationInvalid } from "@repo/config";
import type { FeatureFlags, FlagEditorAccess } from "@repo/feature-flags";
import type { TelemetryInvalid } from "@repo/observability";
import type { AppServices } from "@repo/runtime";

const wikiService = APPLICATION.wiki;

type WikiServices = AppServices | FeatureFlags | FlagEditorAccess;

const featureFlagsLayer = (config: AppConfig): Layer.Layer<FeatureFlags> =>
  config.FLAGS === undefined ? memoryFeatureFlagsLayer : flagshipFeatureFlagsLayer(config.FLAGS);

function wikiLayer(
  env: unknown,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<WikiServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> {
  return Layer.unwrap(
    readWorkerConfig(env).pipe(
      Effect.map((config) =>
        Layer.mergeAll(
          configuredAppLayer(config, wikiService, routes),
          featureFlagsLayer(config),
          allowAllEditors,
        ),
      ),
    ),
  );
}

export { wikiLayer, wikiService };
export type { WikiServices };
