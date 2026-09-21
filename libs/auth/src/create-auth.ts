import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { APPLICATION, applications, type Application } from "@repo/config";
import { AUTHENTICATION_METHOD, ROLE, authenticationMethods, roles } from "@repo/config/identity";
import { claimMailSlot, findUser, schema, type DrizzleDatabase } from "@repo/db";
import { logAt, logCause } from "@repo/observability";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createEmailVerificationToken } from "better-auth/api";
import { Effect, Cause } from "effect";

import { authPlugins } from "./auth-plugins.ts";
import {
  sendEmailChangeCompleted,
  sendEmailChangeNotice,
  sendEmailChangeVerification,
  sendExistingAccountNotice,
  sendVerificationEmail,
  type MailSettings,
} from "./email.ts";
import { assertEligibleUser, authenticationMethodFor } from "./policy.ts";
import { createRequestHooks } from "./request-hooks.ts";
import { emailChangeTarget } from "./verification-token.ts";

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
          const user = await run(findUser(candidate.userId));
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
const EXISTING_ACCOUNT_NOTICE_MINUTES = 10;
const MILLISECONDS_PER_SECOND = 1000;
const EXISTING_ACCOUNT_NOTICE_MILLISECONDS =
  EXISTING_ACCOUNT_NOTICE_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

const verificationLink = (origin: string, token: string): string => {
  return new URL(`/verify-email#${new URLSearchParams({ token }).toString()}`, origin).href;
};

const emailChangeLink = (origin: string, token: string): string => {
  return new URL(`/verify-email-change#${new URLSearchParams({ token }).toString()}`, origin).href;
};

export type AuthOptions = {
  readonly baseURL: string;
  readonly secret: string;
  readonly audience: Application;
  readonly mail: MailSettings;
};

const mailExistingAccount = Effect.fn("mailExistingAccount")(function* mailExistingAccount({
  authOptions,
  origin,
  user,
}: {
  readonly authOptions: AuthOptions;
  readonly origin: string;
  readonly user: Readonly<{ email: string; emailVerified: boolean }>;
}) {
  const until = new Date(Date.now() + EXISTING_ACCOUNT_NOTICE_MILLISECONDS);
  const identifier = `existing-account-notice:${user.email}`;
  if (!(yield* claimMailSlot({ audience: authOptions.audience, identifier, until }))) {
    yield* logAt("Warn", { eventName: "authentication.existing_account_notice_throttled" });
    return;
  }
  if (user.emailVerified) {
    yield* sendExistingAccountNotice(authOptions.mail, {
      email: user.email,
      url: new URL("/login", origin).href,
    });
    return;
  }
  const token = yield* Effect.promise(async () =>
    createEmailVerificationToken(authOptions.secret, user.email),
  );
  yield* sendVerificationEmail(authOptions.mail, {
    email: user.email,
    url: verificationLink(origin, token),
  });
});

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
      await run(
        emailChangeTarget(token) === undefined
          ? sendVerificationEmail(authOptions.mail, {
              email: user.email,
              url: verificationLink(origin, token),
            })
          : sendEmailChangeVerification(authOptions.mail, {
              email: user.email,
              url: emailChangeLink(origin, token),
            }),
      );
    },
  };
};

const createEmailChangeNotifier = (
  authOptions: AuthOptions,
  { origin, run }: Readonly<{ origin: string; run: Run }>,
): ((email: string) => Promise<void>) => {
  return async (email) => {
    await run(
      sendEmailChangeNotice(authOptions.mail, {
        email,
        url: new URL("/settings/security", origin).href,
      }),
    );
  };
};

const createEmailChangeCompletedNotifier = (
  authOptions: AuthOptions,
  { origin, run }: Readonly<{ origin: string; run: Run }>,
): ((email: string) => Promise<void>) => {
  return async (email) => {
    await run(
      sendEmailChangeCompleted(authOptions.mail, {
        email,
        url: new URL("/settings/security", origin).href,
      }),
    );
  };
};

const createLogger = (run: Run): NonNullable<BetterAuthOptions["logger"]> => {
  return {
    level: "warn",
    log: (level, _description, ...details: readonly unknown[]) => {
      const cause = details.find((detail) => detail instanceof Error);
      void run(
        level === "error"
          ? cause === undefined
            ? logAt("Error", { eventName: "authentication.failed" })
            : logCause({ cause: Cause.fail(cause), eventName: "authentication.failed" })
          : logAt(level === "warn" ? "Warn" : "Info", {
              attributes: { level },
              eventName: "authentication.diagnostic",
            }),
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
  authOptions: AuthOptions,
  { origin, run }: Readonly<{ origin: string; run: Run }>,
): NonNullable<BetterAuthOptions["emailAndPassword"]> => {
  return {
    disableSignUp: authOptions.audience !== APPLICATION.user,
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    onExistingUserSignUp: async ({
      user,
    }: Readonly<{ user: Readonly<{ email: string; emailVerified: boolean }> }>) => {
      await run(mailExistingAccount({ authOptions, origin, user }));
    },
    requireEmailVerification: true,
  };
};

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export type BetterAuthInstance = {
  readonly $context: Promise<unknown>;
  readonly api: unknown;
  readonly handler: unknown;
  readonly options: unknown;
};

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
    emailAndPassword: createEmailAndPassword(authOptions, { origin, run }),
    emailVerification: createEmailVerification(authOptions, { origin, run }),
    hooks: createRequestHooks({
      audience,
      onEmailChangeCompleted: createEmailChangeCompletedNotifier(authOptions, { origin, run }),
      onEmailChangeRequested: createEmailChangeNotifier(authOptions, { origin, run }),
      run,
    }),
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
      changeEmail: { enabled: audience === APPLICATION.user },
      deleteUser: { enabled: false },
    },
  }) as BetterAuthInstance;
};
