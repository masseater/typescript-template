import type { AppConfig, Application, ConfigurationInvalid } from "@repo/config";
import { Effect, Layer } from "effect";
import { readConfig, sendVerificationEmail } from "@repo/config";
import { AppOrigin } from "./app-origin.ts";
import { Assets } from "./assets.ts";
import { Auth } from "@repo/auth";
import type { AuthFailure } from "@repo/auth";
import { Database } from "@repo/db";
import type { OtlpExporter } from "effect/unstable/observability";
import { Telemetry } from "@repo/observability";
import type { TelemetryInvalid } from "@repo/observability";

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
    readConfig(env).pipe(Effect.map((config) => configuredAppLayer(config, audience, routes))),
  );
}

export { appLayer, configuredAppLayer };
export type { AppServices };
