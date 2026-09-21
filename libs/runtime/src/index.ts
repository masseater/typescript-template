import { Auth } from "@repo/auth";
import { Database } from "@repo/db";
import { Telemetry } from "@repo/observability";
import { Layer } from "effect";

import { AppOrigin } from "./app-origin.ts";
import { Assets } from "./assets.ts";
import { DatabaseHealth } from "./database-health.ts";
import { FileStore } from "./file-store.ts";
import { ReadCache } from "./read-cache.ts";

import type { AuthFailure } from "@repo/auth";
import type { AppConfig, Application } from "@repo/config";
import type { TelemetryFlusher, TelemetryInvalid } from "@repo/observability";

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

function configuredAppLayer(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  config: AppConfig,
  audience: Application,
  routes: Readonly<Record<string, string>>,
  storage: {
    readonly cache: Parameters<typeof ReadCache.layer>[0];
    readonly files: Parameters<typeof FileStore.layer>[0];
  } = { cache: undefined, files: undefined },
): Layer.Layer<AppServices, AuthFailure | TelemetryInvalid> {
  const database = DatabaseHealth.layer.pipe(Layer.provideMerge(Database.layer(config.DB)));
  const auth = Auth.layer({
    audience,
    baseURL: config.APP_ORIGIN,
    secret: config.AUTH_SECRET,
    mail: config,
  }).pipe(Layer.provideMerge(database));
  const otlp =
    config.OTLP_ENDPOINT === undefined || config.OTLP_ENABLED === "false"
      ? undefined
      : { authorization: config.OTLP_AUTHORIZATION, endpoint: config.OTLP_ENDPOINT };
  const telemetry = Telemetry.layer({
    otlp,
    release: config.APP_RELEASE,
    routes,
    serviceName: audience,
  });
  const services = Layer.mergeAll(
    auth,
    Layer.succeed(AppOrigin, config.APP_ORIGIN),
    Layer.succeed(Assets, config.ASSETS),
    FileStore.layer(storage.files),
    ReadCache.layer(storage.cache),
  );
  return services.pipe(Layer.provideMerge(telemetry));
}

export { configuredAppLayer };
export type { AppServices };
export type { StoredFile } from "./file-store.ts";
export { StorageFailed } from "./storage-failed.ts";
