import { Auth } from "@repo/auth";
import { readConfig } from "@repo/config";
import { Database } from "@repo/db";
import { Telemetry } from "@repo/observability";
import { Effect, Layer } from "effect";

import { AppOrigin } from "./app-origin.ts";
import { Assets } from "./assets.ts";
import { DatabaseHealth } from "./database-health.ts";
import { OpsMail } from "./ops-mail.ts";

import type { AuthFailure } from "@repo/auth";
import type { AppConfig, Application, ConfigurationInvalid } from "@repo/config";
import type { TelemetryFlusher, TelemetryInvalid } from "@repo/observability";

type AppServices =
  | AppOrigin
  | Assets
  | Auth
  | Database
  | DatabaseHealth
  | OpsMail
  | Telemetry
  | TelemetryFlusher;

function configuredAppLayer(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
    Layer.succeed(OpsMail, {
      APP_ORIGIN: config.APP_ORIGIN,
      EMAIL_FROM: config.EMAIL_FROM,
      OPS_EMAIL: config.OPS_EMAIL,
      ...(config.EMAIL === undefined ? {} : { EMAIL: config.EMAIL }),
      ...(config.MAILPIT_SEND_URL === undefined
        ? {}
        : { MAILPIT_SEND_URL: config.MAILPIT_SEND_URL }),
    }),
  );
  return services.pipe(Layer.provideMerge(telemetry));
}

function appLayer(
  env: unknown,
  audience: Exclude<Application, "wiki">,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<AppServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> {
  return Layer.unwrap(
    readConfig(env).pipe(Effect.map((config) => configuredAppLayer(config, audience, routes))),
  );
}

export { appLayer, configuredAppLayer };
export type { AppServices };
