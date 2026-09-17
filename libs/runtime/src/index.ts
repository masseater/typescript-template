import { Auth } from "@template/auth";
import { readConfig, sendVerificationEmail } from "@template/config";
import type { AppConfig, Application } from "@template/config";
import { Database } from "@template/db";
import { Telemetry } from "@template/observability";
import { Effect, Layer } from "effect";
import { AppOrigin, Assets } from "./http.ts";

export type AppServices = Layer.Success<ReturnType<typeof configuredAppLayer>>;

export const configuredAppLayer = (
  config: AppConfig,
  audience: Application,
  routes: Readonly<Record<string, string>>,
) =>
  Layer.mergeAll(
    Auth.layer({
      baseURL: config.APP_ORIGIN,
      secret: config.AUTH_SECRET,
      audience,
      sendVerificationEmail: (message) => sendVerificationEmail(config, message),
    }).pipe(Layer.provideMerge(Database.layer(config.DB))),
    Layer.succeed(AppOrigin, config.APP_ORIGIN),
    Layer.succeed(Assets, config.ASSETS),
  ).pipe(
    Layer.provideMerge(
      Telemetry.layer({ serviceName: audience, release: config.APP_RELEASE, routes }),
    ),
  );

export const appLayer = (
  env: unknown,
  audience: Exclude<Application, "wiki">,
  routes: Readonly<Record<string, string>>,
) =>
  Layer.unwrap(
    readConfig(env).pipe(Effect.map((config) => configuredAppLayer(config, audience, routes))),
  );
