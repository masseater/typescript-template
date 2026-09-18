import {
  applications,
  authenticationMethods,
  minimumPasswordLength,
  roles,
} from "@template/config";
import { assertEligibleUser, authenticationMethodFor } from "./policy.ts";
import type { Application } from "@template/config";
import type { BetterAuthOptions } from "better-auth";
import type { DrizzleDatabase } from "@template/db";
import { Effect } from "effect";
import type { Run } from "./runner.ts";
import { authPlugins } from "./auth-plugins.ts";
import { betterAuth } from "better-auth";
import { createRequestHooks } from "./request-hooks.ts";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { findUser } from "@template/db/security";
import { schema } from "@template/db";

interface AuthOptions {
  readonly baseURL: string;
  readonly secret: string;
  readonly audience: Application;
  readonly sendVerificationEmail: (
    message: Readonly<{ email: string; url: string }>,
  ) => Effect.Effect<void, unknown>;
}

type AdvancedOptions = NonNullable<BetterAuthOptions["advanced"]>;
type EmailAndPasswordOptions = NonNullable<BetterAuthOptions["emailAndPassword"]>;
type DatabaseHooks = NonNullable<BetterAuthOptions["databaseHooks"]>;
type EmailVerificationOptions = NonNullable<BetterAuthOptions["emailVerification"]>;
type LoggerOptions = NonNullable<BetterAuthOptions["logger"]>;
type SessionOptions = NonNullable<BetterAuthOptions["session"]>;

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const ADMIN_SESSION_HOURS = 8;
const USER_SESSION_DAYS = 7;
const FRESH_SESSION_MINUTES = 5;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const ADMIN_SESSION_SECONDS = ADMIN_SESSION_HOURS * SECONDS_PER_HOUR;
const USER_SESSION_SECONDS = USER_SESSION_DAYS * HOURS_PER_DAY * SECONDS_PER_HOUR;
const FRESH_SESSION_SECONDS = FRESH_SESSION_MINUTES * SECONDS_PER_MINUTE;

function createDatabaseHooks(run: Run, audience: Application): DatabaseHooks {
  return {
    session: {
      create: {
        before: async (
          candidate: Readonly<Record<string, unknown> & { userId: string }>,
          ctx: Readonly<{ path: string }> | null,
        ) => {
          const user = (await run(findUser(candidate.userId))) ?? undefined;
          assertEligibleUser(user, audience);
          return {
            data: {
              ...candidate,
              audience,
              authenticatedAt: new Date(),
              authenticationMethod: authenticationMethodFor(ctx?.path),
              securityVersion: user.securityVersion,
            },
          };
        },
      },
    },
    user: {
      create: {
        before: async (user: Readonly<Record<string, unknown>>) => ({
          data: { ...user, role: "user", securityVersion: 0 },
        }),
      },
    },
  };
}

function createEmailVerification(
  options: AuthOptions,
  { origin, run }: Readonly<{ origin: string; run: Run }>,
): EmailVerificationOptions {
  return {
    autoSignInAfterVerification: false,
    sendOnSignIn: options.audience !== "wiki",
    sendOnSignUp: true,
    sendVerificationEmail: async ({
      user,
      token,
    }: Readonly<{ user: Readonly<{ email: string }>; token: string }>) => {
      const link = new URL("/verify-email", origin);
      link.hash = new URLSearchParams({ token }).toString();
      await run(options.sendVerificationEmail({ email: user.email, url: link.href }));
    },
  };
}

function createLogger(run: Run): LoggerOptions {
  return {
    level: "warn",
    log: (level, _message, ...details: readonly unknown[]) => {
      const cause = details.find((detail) => detail instanceof Error);
      void run(
        level === "error"
          ? Effect.logError("authentication.failed", { cause })
          : Effect.logWarning("authentication.diagnostic", { level }),
      );
    },
  };
}

function createAdvancedOptions(audience: Application, origin: string): AdvancedOptions {
  return {
    cookiePrefix: `template-${audience}`,
    crossSubDomainCookies: { enabled: false },
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    useSecureCookies: origin.startsWith("https:"),
  };
}

function createSessionOptions(audience: Application): SessionOptions {
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
        defaultValue: "password",
        input: false,
        required: true,
        type: [...authenticationMethods],
      },
      securityVersion: { defaultValue: -1, input: false, required: true, type: "number" },
    },
    cookieCache: { enabled: false },
    expiresIn: audience === "user" ? USER_SESSION_SECONDS : ADMIN_SESSION_SECONDS,
    freshAge: FRESH_SESSION_SECONDS,
  };
}

function createEmailAndPassword(audience: Application): EmailAndPasswordOptions {
  return {
    disableSignUp: audience !== "user",
    enabled: true,
    minPasswordLength: minimumPasswordLength,
    requireEmailVerification: true,
  };
}

function createAuth(options: AuthOptions, database: DrizzleDatabase, run: Run) {
  const { audience } = options;
  const { origin } = new URL(options.baseURL);
  return betterAuth({
    advanced: createAdvancedOptions(audience, origin),
    appName: "TypeScript Template",
    baseURL: options.baseURL,
    database: drizzleAdapter(database, { provider: "sqlite", schema, transaction: false }),
    databaseHooks: createDatabaseHooks(run, audience),
    emailAndPassword: createEmailAndPassword(audience),
    emailVerification: createEmailVerification(options, { origin, run }),
    hooks: createRequestHooks(run, audience),
    logger: createLogger(run),
    plugins: authPlugins({ audience, origin, run }),
    rateLimit: {
      enabled: true,
      max: RATE_LIMIT_MAX,
      storage: "database",
      window: RATE_LIMIT_WINDOW_SECONDS,
    },
    secret: options.secret,
    session: createSessionOptions(audience),
    trustedOrigins: [origin],
    user: {
      additionalFields: {
        role: { defaultValue: "user", input: false, required: true, type: [...roles] },
        securityVersion: { defaultValue: 0, input: false, required: true, type: "number" },
      },
      deleteUser: { enabled: false },
    },
  });
}

type BetterAuthInstance = ReturnType<typeof createAuth>;

export { createAuth };
export type { AuthOptions, BetterAuthInstance };
