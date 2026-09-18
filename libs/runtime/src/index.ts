import type { AppConfig, Application, ConfigurationInvalid } from "@template/config";
import { Effect, Layer } from "effect";
import { readConfig, sendVerificationEmail } from "@template/config";
import { AppOrigin } from "./app-origin.ts";
import { Assets } from "./assets.ts";
import { Auth } from "@template/auth";
import type { AuthFailure } from "@template/auth";
import { Database } from "@template/db";
import type { OtlpExporter } from "effect/unstable/observability";
import { Telemetry } from "@template/observability";
import type { TelemetryInvalid } from "@template/observability";

type AppServices = Auth | Database | AppOrigin | Assets | OtlpExporter.Flusher | Telemetry;

function configuredAppLayer(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  config: AppConfig,
  audience: Application,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<AppServices, AuthFailure | TelemetryInvalid> {
  const auth = Auth.layer({
    audience,
    baseURL: config.APP_ORIGIN,
    secret: config.AUTH_SECRET,
    sendVerificationEmail: (message) => sendVerificationEmail(config, message),
  }).pipe(Layer.provideMerge(Database.layer(config.DB)));
  const otlp =
    config.OTLP_ENDPOINT === undefined
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

function appLayer(
  env: unknown,
  audience: Exclude<Application, "wiki">,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<AppServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> {
  return Layer.unwrap(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    readConfig(env).pipe(Effect.map((config) => configuredAppLayer(config, audience, routes))),
  );
}

export { appLayer, configuredAppLayer };
export type { AppServices };
