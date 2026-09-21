import { Auth } from "@repo/auth";
import { Database } from "@repo/db";
import { Telemetry } from "@repo/observability";
import { Layer } from "effect";

import { AppOrigin } from "./app-origin.ts";
import { Assets } from "./assets.ts";
import { DatabaseHealth } from "./database-health.ts";

import type { AuthFailure } from "@repo/auth";
import type { AppConfig, Application } from "@repo/config";
import type { TelemetryFlusher, TelemetryInvalid } from "@repo/observability";

type AppServices =
  | AppOrigin
  | Assets
  | Auth
  | Database
  | DatabaseHealth
  | Telemetry
  | TelemetryFlusher;

function configuredAppLayer(
  config: AppConfig,
  audience: Application,
  routes: Readonly<Record<string, string>>,
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
  );
  return services.pipe(Layer.provideMerge(telemetry));
}

export { configuredAppLayer };
export type { AppServices };
