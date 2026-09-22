import { APPLICATION, applicationOrigins, mailpitOrigin } from "@repo/config";
import { Config, ConfigProvider, Effect, Option, Schema } from "effect";

import { failure, type VerifyCommandFailure } from "./failure.ts";

const verifyEnvironments = ["local", "staging", "production"] as const;

const VerifyEnvironment = Schema.Literals(verifyEnvironments);

type VerifyEnvironmentName = typeof VerifyEnvironment.Type;

type ResolvedVerifyEnvironment = {
  readonly adminOrigin: string;
  readonly environment: VerifyEnvironmentName;
  readonly mailboxUrl?: string;
  readonly mailpitOrigin?: string;
  readonly memberOrigin: string;
  readonly wikiOrigin: string;
};

const readOptionalEnv = (name: string): string | undefined =>
  Effect.runSync(
    Config.option(Config.string(name)).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
      Effect.map(Option.getOrUndefined),
    ),
  );

const resolveLocalVerifyEnvironment = (
  environment: VerifyEnvironmentName,
): ResolvedVerifyEnvironment => {
  const mailpit = readOptionalEnv("MAILPIT_URL") ?? mailpitOrigin;
  return {
    adminOrigin: applicationOrigins[APPLICATION.admin],
    environment,
    mailpitOrigin: mailpit,
    memberOrigin: applicationOrigins[APPLICATION.user],
    wikiOrigin: applicationOrigins[APPLICATION.wiki],
  };
};

const requiredEnv = (name: string): Effect.Effect<string, VerifyCommandFailure> => {
  const configuredOrigin = readOptionalEnv(name);
  if (configuredOrigin === undefined || configuredOrigin === "") {
    return failure("credentials_invalid");
  }
  return Effect.succeed(configuredOrigin);
};

const resolveDeployedOrigins = Effect.fn("resolveDeployedOrigins")(
  function* resolveDeployedOrigins() {
    const memberOrigin = yield* requiredEnv("SERVICE_MEMBER_ORIGIN");
    const adminOrigin = yield* requiredEnv("SERVICE_ADMIN_ORIGIN");
    const wikiOrigin = yield* requiredEnv("INTERNAL_DASHBOARD_ORIGIN");
    return { adminOrigin, memberOrigin, wikiOrigin };
  },
);

const resolveStagingVerifyEnvironment = Effect.fn("resolveStagingVerifyEnvironment")(
  function* resolveStagingVerifyEnvironment(
    environment: VerifyEnvironmentName,
    origins: {
      readonly adminOrigin: string;
      readonly memberOrigin: string;
      readonly wikiOrigin: string;
    },
  ) {
    const mailpit = yield* requiredEnv("MAILPIT_URL");
    return {
      ...origins,
      environment,
      mailpitOrigin: mailpit,
    } satisfies ResolvedVerifyEnvironment;
  },
);

const resolveProductionVerifyEnvironment = Effect.fn("resolveProductionVerifyEnvironment")(
  function* resolveProductionVerifyEnvironment(
    environment: VerifyEnvironmentName,
    origins: {
      readonly adminOrigin: string;
      readonly memberOrigin: string;
      readonly wikiOrigin: string;
    },
  ) {
    const mailboxUrl = yield* requiredEnv("AI_MAILBOX_URL");
    return {
      ...origins,
      environment,
      mailboxUrl,
    } satisfies ResolvedVerifyEnvironment;
  },
);

const resolveVerifyEnvironment = Effect.fn("resolveVerifyEnvironment")(
  function* resolveVerifyEnvironment(environment: VerifyEnvironmentName) {
    if (environment === "local") {
      return resolveLocalVerifyEnvironment(environment);
    }
    const origins = yield* resolveDeployedOrigins();
    if (environment === "staging") {
      return yield* resolveStagingVerifyEnvironment(environment, origins);
    }
    return yield* resolveProductionVerifyEnvironment(environment, origins);
  },
);

export { resolveVerifyEnvironment, VerifyEnvironment };
export type { ResolvedVerifyEnvironment };
