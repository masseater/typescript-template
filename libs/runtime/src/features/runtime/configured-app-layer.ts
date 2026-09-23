import { Auth, type AuthFailure } from "@repo/auth";
import { Database } from "@repo/db";
import { Telemetry, type TelemetryFlusher, type TelemetryInvalid } from "@repo/observability";
import { Layer } from "effect";

import { AppOrigin } from "./app-origin.ts";
import { Assets } from "./assets.ts";
import { DatabaseHealth } from "./database-health.ts";
import { FileStore } from "./file-store.ts";
import { ReadCache } from "./read-cache.ts";

import type { AppConfig, Application } from "@repo/config";

type AppServices =
  | AppOrigin
  | Assets
  | Auth
  | Database
  | DatabaseHealth
  | FileStore
  | ReadCache
  | Telemetry
  | TelemetryFlusher;

const configuredAppLayer = (
  asked: Readonly<{
    readonly appConfig: AppConfig;
    readonly audience: Application;
    readonly routes: Readonly<Record<string, string>>;
    readonly storage?: {
      readonly cache: Parameters<typeof ReadCache.layer>[0];
      readonly files: Parameters<typeof FileStore.layer>[0];
    };
  }>,
): Layer.Layer<AppServices, AuthFailure | TelemetryInvalid> => {
  const storage = asked.storage ?? { cache: undefined, files: undefined };
  const database = DatabaseHealth.layer.pipe(
    Layer.provideMerge(Database.layer(asked.appConfig.DB)),
  );
  const auth = Auth.layer({
    audience: asked.audience,
    baseURL: asked.appConfig.APP_ORIGIN,
    secret: asked.appConfig.AUTH_SECRET,
    mail: asked.appConfig,
  }).pipe(Layer.provideMerge(database));
  const otlp =
    asked.appConfig.OTLP_ENDPOINT === undefined || asked.appConfig.OTLP_ENABLED === "false"
      ? undefined
      : {
          authorization: asked.appConfig.OTLP_AUTHORIZATION,
          endpoint: asked.appConfig.OTLP_ENDPOINT,
        };
  const telemetry = Telemetry.layer({
    otlp,
    release: asked.appConfig.APP_RELEASE,
    routes: asked.routes,
    serviceName: asked.audience,
  });
  const services = Layer.mergeAll(
    auth,
    Layer.succeed(AppOrigin, asked.appConfig.APP_ORIGIN),
    Layer.succeed(Assets, asked.appConfig.ASSETS),
    FileStore.layer(storage.files),
    ReadCache.layer(storage.cache),
  );
  return services.pipe(Layer.provideMerge(telemetry));
};

export { configuredAppLayer };
export type { AppServices };
