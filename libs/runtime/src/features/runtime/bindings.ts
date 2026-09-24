import {
  ConfigurationInvalid,
  grants,
  readEnvironment,
  type AppConfig,
  type Application,
  type AssetFetcher,
} from "@repo/config";
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
import type { TelemetryInvalid } from "@repo/observability";
const isFetcher = (decoded: unknown): decoded is AssetFetcher =>
  typeof decoded === "object" &&
  decoded !== null &&
  typeof Reflect.get(decoded, "fetch") === "function";
const isFlagship = (decoded: unknown): decoded is Flagship =>
  typeof decoded === "object" &&
  decoded !== null &&
  ["getBooleanValue", "getStringValue", "getNumberValue", "getObjectValue"].every(
    (method) => typeof Reflect.get(decoded, method) === "function",
  );
class WorkerDatabase extends D1.Service<WorkerDatabase>()("WorkerDatabase", { binding: "DB" }) {}
class WorkerAssets extends Binding.Service<WorkerAssets>()("WorkerAssets", "ASSETS", isFetcher) {}
class OutboundEmail extends Email.Tag<OutboundEmail>()("OutboundEmail") {}
class WorkersModel extends WorkersAi.Tag<WorkersModel>()("WorkersModel") {}
const isWorkerEnv = (env: unknown): env is WorkerEnv =>
  typeof env === "object" && env !== null && !Array.isArray(env);
const bindingPresent = (env: WorkerEnv, spelled: string): boolean =>
  Reflect.get(env, spelled) !== undefined;
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
  const secret = yield* Config.Redacted("AUTH_SECRET");
  const authorization = Option.getOrUndefined(
    yield* Config.option(Config.Redacted("OTLP_AUTHORIZATION")),
  );
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
type WorkerModel = WorkersAi.WorkersAiBinding;
const revealedOrUndefined = (secret: Redacted.Redacted | undefined): string | undefined =>
  secret === undefined ? undefined : Redacted.value(secret);
type EnvironmentScalars = Effect.Success<ReturnType<typeof readEnvironment>>;
const loadedScalarsMatch = (
  scalars: EnvironmentScalars,
  loaded: Readonly<{
    readonly AUTH_SECRET: Redacted.Redacted;
    readonly OTLP_AUTHORIZATION: Redacted.Redacted | undefined;
    readonly EMAIL: SendEmail | undefined;
    readonly FLAGS: unknown;
  }>,
): ConfigurationInvalid | undefined => {
  if (Redacted.value(loaded.AUTH_SECRET) !== Redacted.value(scalars.AUTH_SECRET)) {
    return new ConfigurationInvalid({ reason: "AUTH_SECRET" });
  }
  if (
    revealedOrUndefined(loaded.OTLP_AUTHORIZATION) !==
    revealedOrUndefined(scalars.OTLP_AUTHORIZATION)
  ) {
    return new ConfigurationInvalid({ reason: "OTLP_AUTHORIZATION" });
  }
  if (scalars.MAILPIT_URL === undefined && loaded.EMAIL === undefined) {
    return new ConfigurationInvalid({ reason: "An email delivery binding is required" });
  }
  if (loaded.FLAGS !== undefined && !isFlagship(loaded.FLAGS)) {
    return new ConfigurationInvalid({ reason: "FLAGS" });
  }
  return undefined;
};
const workerAppConfig = (
  asked: Readonly<{
    readonly scalars: EnvironmentScalars;
    readonly loaded: {
      readonly AI: WorkersAi.WorkersAiBinding | undefined;
      readonly ASSETS: AssetFetcher;
      readonly DB: D1Database;
      readonly EMAIL: SendEmail | undefined;
    };
    readonly env: WorkerEnv;
  }>,
): AppConfig & {
  readonly AI: WorkersAi.WorkersAiBinding | undefined;
} => {
  const featureFlags: unknown = Reflect.get(asked.env, "FLAGS");
  return {
    ...asked.scalars,
    AI: asked.loaded.AI,
    ASSETS: asked.loaded.ASSETS,
    DB: asked.loaded.DB,
    ...(asked.loaded.EMAIL === undefined ? {} : { EMAIL: asked.loaded.EMAIL }),
    ...(isFlagship(featureFlags) ? { FLAGS: featureFlags } : {}),
  };
};
const readWorkerConfig = Effect.fn("readWorkerConfig")(function* readWorkerConfig(env: unknown) {
  if (!isWorkerEnv(env)) {
    return yield* new ConfigurationInvalid({ reason: "WorkerEnvironment object" });
  }
  const scalars = yield* readEnvironment(env);
  const loaded: {
    readonly AI: WorkersAi.WorkersAiBinding | undefined;
    readonly ASSETS: AssetFetcher;
    readonly AUTH_SECRET: Redacted.Redacted;
    readonly DB: D1Database;
    readonly EMAIL: SendEmail | undefined;
    readonly OTLP_AUTHORIZATION: Redacted.Redacted | undefined;
  } = yield* loadedBinding.pipe(
    Effect.provide(bindingsFor(env)),
    Effect.mapError((cause) => new ConfigurationInvalid({ reason: bindingReason(cause) })),
  );
  const mismatch = loadedScalarsMatch(scalars, { ...loaded, FLAGS: Reflect.get(env, "FLAGS") });
  if (mismatch !== undefined) {
    return yield* mismatch;
  }
  return workerAppConfig({ env, loaded, scalars });
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
export type { WorkerModel };
