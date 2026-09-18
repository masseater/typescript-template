import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
  APPLICATION,
  AUTHENTICATION_METHOD,
  ROLE,
  applications,
  authenticationMethods,
  roles,
  type Application,
} from "@template/config";
import { schema, type DrizzleDatabase } from "@template/db";
import { findUser } from "@template/db/security";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { Effect } from "effect";

import { authPlugins } from "./auth-plugins.ts";
import { assertEligibleUser, authenticationMethodFor } from "./policy.ts";
import { createRequestHooks } from "./request-hooks.ts";

import type { GenerateId } from "./auth-identifiers.ts";
import type { Run } from "./runner.ts";

const createDatabaseHooks = (
  run: Run,
  audience: Application,
): NonNullable<BetterAuthOptions["databaseHooks"]> => {
  return {
    session: {
      create: {
        before: async (
          candidate: Readonly<Record<string, unknown> & { userId: string }>,
          hookContext: Readonly<{ path: string }> | null,
        ) => {
          const user = (await run(findUser(candidate.userId))) ?? undefined;
          assertEligibleUser(user, audience);
          return {
            data: {
              ...candidate,
              audience,
              authenticatedAt: new Date(),
              authenticationMethod: authenticationMethodFor(hookContext?.path),
              securityVersion: user.securityVersion,
            },
          };
        },
      },
    },
    user: {
      create: {
        before: (createdUser: Readonly<Record<string, unknown>>) =>
          Promise.resolve({ data: { ...createdUser, role: ROLE.member, securityVersion: 0 } }),
      },
    },
  };
};

export type AuthOptions = {
  readonly baseURL: string;
  readonly secret: string;
  readonly audience: Application;
  readonly sendVerificationEmail: (
    verification: Readonly<{ email: string; url: string }>,
  ) => Effect.Effect<void, unknown>;
};

const createEmailVerification = (
  authOptions: AuthOptions,
  { origin, run }: Readonly<{ origin: string; run: Run }>,
): NonNullable<BetterAuthOptions["emailVerification"]> => {
  return {
    autoSignInAfterVerification: false,
    sendOnSignIn: authOptions.audience !== APPLICATION.wiki,
    sendOnSignUp: true,
    sendVerificationEmail: async ({
      user,
      token,
    }: Readonly<{ user: Readonly<{ email: string }>; token: string }>) => {
      const link = new URL(`/verify-email#${new URLSearchParams({ token }).toString()}`, origin);
      await run(authOptions.sendVerificationEmail({ email: user.email, url: link.href }));
    },
  };
};

const createLogger = (run: Run): NonNullable<BetterAuthOptions["logger"]> => {
  return {
    level: "warn",
    log: (level, _description, ...details: readonly unknown[]) => {
      const cause = details.find((detail) => detail instanceof Error);
      void run(
        level === "error"
          ? Effect.logError("authentication.failed", { cause })
          : Effect.logWarning("authentication.diagnostic", { level }),
      );
    },
  };
};

const createAdvancedOptions = ({
  audience,
  generateId,
  origin,
}: {
  readonly audience: Application;
  readonly generateId: GenerateId;
  readonly origin: string;
}): NonNullable<BetterAuthOptions["advanced"]> => {
  return {
    cookiePrefix: `template-${audience}`,
    crossSubDomainCookies: { enabled: false },
    database: { generateId },
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    useSecureCookies: origin.startsWith("https:"),
  };
};

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const ADMIN_SESSION_HOURS = 8;
const ADMIN_SESSION_SECONDS = ADMIN_SESSION_HOURS * SECONDS_PER_HOUR;
const HOURS_PER_DAY = 24;
const USER_SESSION_DAYS = 7;
const USER_SESSION_SECONDS = USER_SESSION_DAYS * HOURS_PER_DAY * SECONDS_PER_HOUR;
const FRESH_SESSION_MINUTES = 5;
const FRESH_SESSION_SECONDS = FRESH_SESSION_MINUTES * SECONDS_PER_MINUTE;

const createSessionOptions = (audience: Application): NonNullable<BetterAuthOptions["session"]> => {
  return {
    additionalFields: {
      audience: {
        defaultValue: audience,
        input: false,
        required: true,
        type: [...applications],
      },
      authenticatedAt: { input: false, required: false, type: "date" },
      authenticationMethod: {
        defaultValue: AUTHENTICATION_METHOD.password,
        input: false,
        required: true,
        type: [...authenticationMethods],
      },
      securityVersion: { defaultValue: -1, input: false, required: true, type: "number" },
    },
    cookieCache: { enabled: false },
    expiresIn: audience === APPLICATION.user ? USER_SESSION_SECONDS : ADMIN_SESSION_SECONDS,
    freshAge: FRESH_SESSION_SECONDS,
  };
};

const MIN_PASSWORD_LENGTH = 12;

const createEmailAndPassword = (
  audience: Application,
): NonNullable<BetterAuthOptions["emailAndPassword"]> => {
  return {
    disableSignUp: audience !== APPLICATION.user,
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    requireEmailVerification: true,
  };
};

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export const createAuth = ({
  authOptions,
  database,
  generateId,
  run,
}: {
  readonly authOptions: AuthOptions;
  readonly database: DrizzleDatabase;
  readonly generateId: GenerateId;
  readonly run: Run;
}) => {
  const { audience } = authOptions;
  const { origin } = new URL(authOptions.baseURL);
  return betterAuth({
    advanced: createAdvancedOptions({ audience, generateId, origin }),
    appName: "TypeScript Template",
    baseURL: authOptions.baseURL,
    database: drizzleAdapter(database, { provider: "sqlite", schema, transaction: false }),
    databaseHooks: createDatabaseHooks(run, audience),
    emailAndPassword: createEmailAndPassword(audience),
    emailVerification: createEmailVerification(authOptions, { origin, run }),
    hooks: createRequestHooks(run, audience),
    logger: createLogger(run),
    plugins: authPlugins({ audience, origin, run }),
    rateLimit: {
      enabled: true,
      max: RATE_LIMIT_MAX,
      storage: "database",
      window: RATE_LIMIT_WINDOW_SECONDS,
    },
    secret: authOptions.secret,
    session: createSessionOptions(audience),
    trustedOrigins: [origin],
    user: {
      additionalFields: {
        role: { defaultValue: ROLE.member, input: false, required: true, type: [...roles] },
        securityVersion: { defaultValue: 0, input: false, required: true, type: "number" },
      },
      deleteUser: { enabled: false },
    },
  });
};

export type BetterAuthInstance = ReturnType<typeof createAuth>;
