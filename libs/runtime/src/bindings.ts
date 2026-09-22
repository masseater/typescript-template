import { ConfigurationInvalid, grants, readEnvironment } from "@repo/config";
import { readOptionalStorage, readStorage } from "@repo/config/storage";
import { Config, Effect, Layer, Option, Redacted } from "effect";
import {
  Binding,
  D1,
  Email,
  WorkerConfig,
  WorkerEnvironment,
  WorkersAi,
  type WorkerEnv,
} from "effect-cf";

import { configuredAppLayer, type AppServices } from "./index.ts";

import type { D1Database, Flagship, SendEmail } from "@cloudflare/workers-types";
import type { AuthFailure } from "@repo/auth";
import type { AppConfig, Application, AssetFetcher } from "@repo/config";
import type { TelemetryInvalid } from "@repo/observability";

const isFetcher = (value: unknown): value is AssetFetcher =>
  typeof value === "object" && value !== null && typeof Reflect.get(value, "fetch") === "function";

const isFlagship = (value: unknown): value is Flagship =>
  typeof value === "object" &&
  value !== null &&
  ["getBooleanValue", "getStringValue", "getNumberValue", "getObjectValue"].every(
    (method) => typeof Reflect.get(value, method) === "function",
  );

class WorkerDatabase extends D1.Service<WorkerDatabase>()("WorkerDatabase", { binding: "DB" }) {}

class WorkerAssets extends Binding.Service<WorkerAssets>()("WorkerAssets", "ASSETS", isFetcher) {}

class OutboundEmail extends Email.Tag<OutboundEmail>()("OutboundEmail") {}

class WorkersModel extends WorkersAi.Tag<WorkersModel>()("WorkersModel") {}

const isWorkerEnv = (env: unknown): env is WorkerEnv =>
  typeof env === "object" && env !== null && !Array.isArray(env);

const bindingPresent = (env: WorkerEnv, name: string): boolean =>
  Reflect.get(env, name) !== undefined;

const sharedBindings = Layer.mergeAll(
  WorkerDatabase.layer,
  WorkerAssets.layer,
  WorkerConfig.providerLayer,
);

const optionalBindings = (env: WorkerEnv) =>
  Layer.mergeAll(
    bindingPresent(env, "EMAIL") ? OutboundEmail.layer({ binding: "EMAIL" }) : Layer.empty,
    bindingPresent(env, "AI") ? WorkersModel.layer({ binding: "AI" }) : Layer.empty,
  );

const bindingsFor = (env: WorkerEnv) =>
  Layer.mergeAll(sharedBindings, optionalBindings(env)).pipe(
    Layer.provideMerge(Layer.succeed(WorkerEnvironment, env)),
  );

const bindingReason = (cause: unknown): string => {
  if (typeof cause !== "object" || cause === null || !("message" in cause)) {
    return "Cloudflare binding is invalid";
  }
  return typeof cause.message === "string" && cause.message !== ""
    ? cause.message
    : "Cloudflare binding is invalid";
};

const loadedBinding = Effect.gen(function* loadedBinding() {
  const database = yield* WorkerDatabase;
  const assets = yield* WorkerAssets;
  const secret = Redacted.value(yield* Config.redacted("AUTH_SECRET"));
  const authorization = Option.match(yield* Config.option(Config.redacted("OTLP_AUTHORIZATION")), {
    onNone: (): string | undefined => undefined,
    onSome: (value) => Redacted.value(value),
  });
  const email = yield* Effect.serviceOption(OutboundEmail);
  const model = yield* Effect.serviceOption(WorkersModel);
  return {
    AI: Option.isNone(model) ? undefined : yield* model.value.rawUnsafe,
    ASSETS: assets,
    AUTH_SECRET: secret,
    DB: database,
    EMAIL: Option.isNone(email) ? undefined : yield* email.value.rawUnsafe,
    OTLP_AUTHORIZATION: authorization,
  };
});

type LoadedBinding = {
  readonly AI: WorkersAi.WorkersAiBinding | undefined;
  readonly ASSETS: AssetFetcher;
  readonly AUTH_SECRET: string;
  readonly DB: D1Database;
  readonly EMAIL: SendEmail | undefined;
  readonly OTLP_AUTHORIZATION: string | undefined;
};

type WorkerAppConfig = AppConfig & { readonly AI: WorkersAi.WorkersAiBinding | undefined };

type WorkerModel = WorkersAi.WorkersAiBinding;

const readWorkerConfig = Effect.fn("readWorkerConfig")(function* readWorkerConfig(env: unknown) {
  if (!isWorkerEnv(env)) {
    return yield* new ConfigurationInvalid({ reason: "WorkerEnvironment object" });
  }
  const scalars = yield* readEnvironment(env);
  const loaded: LoadedBinding = yield* loadedBinding.pipe(
    Effect.provide(bindingsFor(env)),
    Effect.mapError((cause) => new ConfigurationInvalid({ reason: bindingReason(cause) })),
  );
  if (loaded.AUTH_SECRET !== scalars.AUTH_SECRET) {
    return yield* new ConfigurationInvalid({ reason: "AUTH_SECRET" });
  }
  if (loaded.OTLP_AUTHORIZATION !== scalars.OTLP_AUTHORIZATION) {
    return yield* new ConfigurationInvalid({ reason: "OTLP_AUTHORIZATION" });
  }
  if (scalars.MAILPIT_URL === undefined && loaded.EMAIL === undefined) {
    return yield* new ConfigurationInvalid({ reason: "An email delivery binding is required" });
  }
  const flags = Reflect.get(env, "FLAGS");
  const config: WorkerAppConfig = {
    ...scalars,
    AI: loaded.AI,
    ASSETS: loaded.ASSETS,
    DB: loaded.DB,
    ...(loaded.EMAIL === undefined ? {} : { EMAIL: loaded.EMAIL }),
    ...(isFlagship(flags) ? { FLAGS: flags } : {}),
  };
  return config;
});

function appLayer(
  env: unknown,
  audience: Exclude<Application, "internal-dashboard">,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<AppServices, ConfigurationInvalid | AuthFailure | TelemetryInvalid> {
  return Layer.unwrap(
    readWorkerConfig(env).pipe(
      Effect.flatMap((config) =>
        Effect.gen(function* withStorage() {
          const storage = grants(audience, "storage")
            ? yield* readStorage(env)
            : yield* readOptionalStorage(env);
          return configuredAppLayer(config, audience, routes, storage);
        }),
      ),
    ),
  );
}

export { appLayer, readWorkerConfig };
export type { WorkerModel };
