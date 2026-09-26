import {
  grants,
  readAi,
  readConfig,
  type Application,
  type ConfigurationInvalid,
} from "@repo/config";
import { readOptionalStorage, readStorage } from "@repo/config/storage";
import { Effect, Layer } from "effect";

import { configuredAppLayer, type AppServices } from "./index.ts";

import type { AuthFailure } from "@repo/auth";
import type { TelemetryInvalid } from "@repo/observability";

const readWorkerConfig = Effect.fn("readWorkerConfig")(function* readWorkerConfig(env: unknown) {
  const config = yield* readConfig(env);
  const AI = yield* readAi(env);
  return { ...config, AI };
});

const readAppStorage = (
  env: unknown,
  audience: Application,
): ReturnType<typeof readStorage> | ReturnType<typeof readOptionalStorage> =>
  grants(audience, "storage") ? readStorage(env) : readOptionalStorage(env);

const appLayer = (asked: {
  readonly env: unknown;
  readonly audience: Exclude<Application, "internal-dashboard">;
  readonly routes: Readonly<Record<string, string>>;
}): Layer.Layer<AppServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> => {
  return Layer.unwrap(
    readWorkerConfig(asked.env).pipe(
      Effect.flatMap((config) =>
        Effect.gen(function* withStorage() {
          const storage = yield* readAppStorage(asked.env, asked.audience);
          return configuredAppLayer({
            appConfig: config,
            audience: asked.audience,
            routes: asked.routes,
            storage,
          });
        }),
      ),
    ),
  );
};
export { appLayer, readAppStorage, readWorkerConfig };
