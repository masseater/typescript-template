import { Auth } from "@template/auth";
import { readConfig, sendVerificationEmail } from "@template/config";
import { Database } from "@template/db";
import { Telemetry } from "@template/observability";
import { Effect, Layer } from "effect";

import { AppOrigin } from "./app-origin.ts";
import { Assets } from "./assets.ts";

import type { AuthFailure } from "@template/auth";
import type { AppConfig, Application, ConfigurationInvalid } from "@template/config";
import type { TelemetryInvalid } from "@template/observability";

type AppServices = Auth | Database | AppOrigin | Assets | Telemetry;

const configuredAppLayer = (
  config: AppConfig,
  audience: Application,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<AppServices, AuthFailure | TelemetryInvalid> => {
  const auth = Auth.layer({
    audience,
    baseURL: config.APP_ORIGIN,
    secret: config.AUTH_SECRET,
    sendVerificationEmail: (message) => sendVerificationEmail(config, message),
  }).pipe(Layer.provideMerge(Database.layer(config.DB)));
  const telemetry = Telemetry.layer({ release: config.APP_RELEASE, routes, serviceName: audience });
  const services = Layer.mergeAll(
    auth,
    Layer.succeed(AppOrigin, config.APP_ORIGIN),
    Layer.succeed(Assets, config.ASSETS),
  );
  return services.pipe(Layer.provideMerge(telemetry));
};

const appLayer = (
  env: unknown,
  audience: Exclude<Application, "wiki">,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<AppServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> => {
  return Layer.unwrap(
    readConfig(env).pipe(Effect.map((config) => configuredAppLayer(config, audience, routes))),
  );
};

export { appLayer, configuredAppLayer };
export type { AppServices };
