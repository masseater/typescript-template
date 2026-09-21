import { APPLICATION, STAFF_PERMISSION, grantsStaffLevel } from "@repo/config";
import {
  FlagEditorAccess,
  FlagEditorRequired,
  flagshipFeatureFlagsLayer,
  memoryFeatureFlagsLayer,
} from "@repo/feature-flags";
import { configuredAppLayer } from "@repo/runtime";
import { readWorkerConfig } from "@repo/runtime/bindings";
import { Effect, Layer } from "effect";

import { Embedder, embedWith } from "./embedder.ts";
import { readWikiConfig, type WikiConfig } from "./wiki-config.ts";

import type { AuthFailure } from "@repo/auth";
import type { AppConfig, ConfigurationInvalid } from "@repo/config";
import type { FeatureFlags } from "@repo/feature-flags";
import type { TelemetryInvalid } from "@repo/observability";
import type { AppServices } from "@repo/runtime";

const wikiService = APPLICATION.wiki;

type WikiServices = AppServices | Embedder | FeatureFlags;

const staffFlagEditors = Layer.succeed(FlagEditorAccess, {
  assertEditor: (user) =>
    grantsStaffLevel(user.permission, STAFF_PERMISSION.editor)
      ? Effect.void
      : Effect.fail(new FlagEditorRequired()),
});

const featureFlagsLayer = (
  config: AppConfig & { readonly AI: unknown },
): Layer.Layer<FeatureFlags> =>
  config.FLAGS === undefined ? memoryFeatureFlagsLayer : flagshipFeatureFlagsLayer(config.FLAGS);

function wikiLayer(
  env: unknown,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<WikiServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> {
  return Layer.unwrap(
    readWorkerConfig(env).pipe(
      Effect.map((config) => {
        const embedder = Embedder.of({
          available: config.AI !== undefined,
          embed: embedWith(config.AI),
        });
        return Layer.mergeAll(
          Layer.succeed(Embedder, embedder),
          configuredAppLayer(config, wikiService, routes),
          featureFlagsLayer(config),
          staffFlagEditors,
        );
      }),
    ),
  );
}

export { wikiLayer, wikiService };
export type { WikiServices };
