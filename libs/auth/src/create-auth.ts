import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { applications, authenticationMethods, roles } from "@repo/config";
import { schema } from "@repo/db";
import { claimMailSlot, findUser } from "@repo/db/security";
import { logAt } from "@repo/observability";
import { betterAuth } from "better-auth";
import { createEmailVerificationToken } from "better-auth/api";
import { Effect } from "effect";

import { authPlugins } from "./auth-plugins.ts";
import { sendExistingAccountNotice, sendVerificationEmail } from "./email.ts";
import { assertEligibleUser, authenticationMethodFor } from "./policy.ts";
import { createRequestHooks } from "./request-hooks.ts";

import type { Application } from "@repo/config";
import type { DrizzleDatabase } from "@repo/db";
import type { BetterAuthOptions } from "better-auth";
import type { MailSettings } from "./email.ts";
import type { Run } from "./runner.ts";

interface AuthOptions {
  readonly baseURL: string;
  readonly secret: string;
  readonly audience: Application;
  readonly mail: MailSettings;
}

type AdvancedOptions = NonNullable<BetterAuthOptions["advanced"]>;
type EmailAndPasswordOptions = NonNullable<BetterAuthOptions["emailAndPassword"]>;
type DatabaseHooks = NonNullable<BetterAuthOptions["databaseHooks"]>;
type EmailVerificationOptions = NonNullable<BetterAuthOptions["emailVerification"]>;
type LoggerOptions = NonNullable<BetterAuthOptions["logger"]>;
type SessionOptions = NonNullable<BetterAuthOptions["session"]>;

const MIN_PASSWORD_LENGTH = 12;
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
const EXISTING_ACCOUNT_NOTICE_MINUTES = 10;
const MILLISECONDS_PER_SECOND = 1000;
const EXISTING_ACCOUNT_NOTICE_MILLISECONDS =
  EXISTING_ACCOUNT_NOTICE_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

function verificationLink(origin: string, token: string): string {
  const link = new URL("/verify-email", origin);
  link.hash = new URLSearchParams({ token }).toString();
  return link.href;
}

const mailExistingAccount = Effect.fn("mailExistingAccount")(function* mailExistingAccount(
  options: AuthOptions,
  origin: string,
  user: Readonly<{ email: string; emailVerified: boolean }>,
) {
  const until = new Date(Date.now() + EXISTING_ACCOUNT_NOTICE_MILLISECONDS);
  const identifier = `existing-account-notice:${user.email}`;
  if (!(yield* claimMailSlot(identifier, options.audience, until))) {
    yield* logAt("Warn", "authentication.existing_account_notice_throttled");
    return;
  }
  if (user.emailVerified) {
    yield* sendExistingAccountNotice(options.mail, user.email, new URL("/login", origin).href);
    return;
  }
  const token = yield* Effect.promise(async () =>
    createEmailVerificationToken(options.secret, user.email),
  );
  yield* sendVerificationEmail(options.mail, user.email, verificationLink(origin, token));
});

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
      await run(sendVerificationEmail(options.mail, user.email, verificationLink(origin, token)));
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
          ? logAt("Error", "authentication.failed", {
              ...(cause === undefined
                ? {}
                : { "error.message": cause.message, "error.type": cause.name }),
            })
          : logAt(level === "warn" ? "Warn" : "Info", "authentication.diagnostic", { level }),
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

function createEmailAndPassword(
  options: AuthOptions,
  { origin, run }: Readonly<{ origin: string; run: Run }>,
): EmailAndPasswordOptions {
  return {
    disableSignUp: options.audience !== "user",
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    onExistingUserSignUp: async ({
      user,
    }: Readonly<{ user: Readonly<{ email: string; emailVerified: boolean }> }>) => {
      await run(mailExistingAccount(options, origin, user));
    },
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
    emailAndPassword: createEmailAndPassword(options, { origin, run }),
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
