import { APPLICATION, STAFF_PERMISSION, grantsStaffLevel } from "@repo/config";
import {
  FlagEditorAccess,
  FlagEditorRequired,
  configuredFeatureFlagsLayer,
} from "@repo/feature-flags";
import { configuredAppLayer } from "@repo/runtime";
import { readAppStorage, readWorkerConfig } from "@repo/runtime/bindings";
import { Effect, Layer } from "effect";

import { WikiPublisher } from "#shared/wiki-publish/index.ts";

import type { AuthFailure } from "@repo/auth";
import type { ConfigurationInvalid } from "@repo/config";
import type { FeatureFlags } from "@repo/feature-flags";
import type { TelemetryInvalid } from "@repo/observability";
import type { AppServices } from "@repo/runtime";

const wikiService = APPLICATION.dashboard;

type WikiServices = AppServices | FeatureFlags | FlagEditorAccess | WikiPublisher;

const staffFlagEditors = Layer.succeed(FlagEditorAccess, {
  assertEditor: (user) =>
    grantsStaffLevel(user.permission, STAFF_PERMISSION.editor)
      ? Effect.void
      : Effect.fail(new FlagEditorRequired()),
});

function wikiLayer(
  env: unknown,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<WikiServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> {
  return Layer.unwrap(
    readWorkerConfig(env).pipe(
      Effect.flatMap((config) =>
        Effect.gen(function* wikiServices() {
          const flags = yield* configuredFeatureFlagsLayer(config);
          const storage = yield* readAppStorage(env, wikiService);
          return Layer.mergeAll(
            configuredAppLayer({ appConfig: config, audience: wikiService, routes, storage }),
            flags,
            staffFlagEditors,
            WikiPublisher.fromEnvironment(env),
          );
        }),
      ),
    ),
  );
}

export { wikiLayer, wikiService };
export type { WikiServices };
