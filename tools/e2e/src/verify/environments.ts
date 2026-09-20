import { APPLICATION, applicationOrigins, mailpitOrigin } from "@repo/config";
import { Effect, Schema } from "effect";

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

const resolveLocalVerifyEnvironment = (
  environment: VerifyEnvironmentName,
): ResolvedVerifyEnvironment => {
  const mailpit = process.env.MAILPIT_URL ?? mailpitOrigin;
  return {
    adminOrigin: applicationOrigins[APPLICATION.admin],
    environment,
    mailpitOrigin: mailpit,
    memberOrigin: applicationOrigins[APPLICATION.user],
    wikiOrigin: applicationOrigins[APPLICATION.wiki],
  };
};

const resolveDeployedOrigins = Effect.fn("resolveDeployedOrigins")(
  function* resolveDeployedOrigins() {
    const requiredOrigin = (
      configuredOrigin: string | undefined,
    ): Effect.Effect<string, VerifyCommandFailure> => {
      if (configuredOrigin === undefined || configuredOrigin === "") {
        return Effect.fail(failure("credentials_invalid"));
      }
      return Effect.succeed(configuredOrigin);
    };
    const memberOrigin = yield* requiredOrigin(process.env.SERVICE_MEMBER_ORIGIN);
    const adminOrigin = yield* requiredOrigin(process.env.SERVICE_ADMIN_ORIGIN);
    const wikiOrigin = yield* requiredOrigin(process.env.INTERNAL_DASHBOARD_ORIGIN);
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
    const requiredOrigin = (
      configuredOrigin: string | undefined,
    ): Effect.Effect<string, VerifyCommandFailure> => {
      if (configuredOrigin === undefined || configuredOrigin === "") {
        return Effect.fail(failure("credentials_invalid"));
      }
      return Effect.succeed(configuredOrigin);
    };
    const mailpit = yield* requiredOrigin(process.env.MAILPIT_URL);
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
    const requiredOrigin = (
      configuredOrigin: string | undefined,
    ): Effect.Effect<string, VerifyCommandFailure> => {
      if (configuredOrigin === undefined || configuredOrigin === "") {
        return Effect.fail(failure("credentials_invalid"));
      }
      return Effect.succeed(configuredOrigin);
    };
    const mailboxUrl = yield* requiredOrigin(process.env.AI_MAILBOX_URL);
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
