import { applications, authenticationMethods, roles } from "@template/config";
import { assertEligibleUser, authenticationMethodFor, deny, isStrongMethod } from "./policy.ts";
import { findUser, getSessionSecurity } from "@template/db/security";
import { APIError } from "better-auth/api";
import type { Application } from "@template/config";
import type { BetterAuthOptions } from "better-auth";
import type { Database } from "@template/db";
import type { SessionSecurity } from "@template/db/security";
import { authPlugins } from "./auth-plugins.ts";
import { betterAuth } from "better-auth";
import { createRequestHooks } from "./request-hooks.ts";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { schema } from "@template/db";

interface AuthOptions {
  readonly database: Database;
  readonly baseURL: string;
  readonly secret: string;
  readonly audience: Application;
  readonly sendVerificationEmail: (
    message: Readonly<{ email: string; url: string }>,
  ) => Promise<void>;
  readonly onError?: (error: unknown) => void;
}

interface VerifySessionOptions {
  readonly auth: Auth;
  readonly database: Database;
  readonly headers: Headers;
  readonly audience: Application;
  readonly allowEnrollment?: boolean;
}

interface VerifiedSession {
  readonly session: SessionSecurity["session"];
  readonly strong: boolean;
  readonly user: SessionSecurity["user"];
}

type AdvancedOptions = NonNullable<BetterAuthOptions["advanced"]>;
type EmailAndPasswordOptions = NonNullable<BetterAuthOptions["emailAndPassword"]>;
type DatabaseHooks = NonNullable<BetterAuthOptions["databaseHooks"]>;
type EmailVerificationOptions = NonNullable<BetterAuthOptions["emailVerification"]>;
type LoggerOptions = NonNullable<BetterAuthOptions["logger"]>;
type SessionOptions = NonNullable<BetterAuthOptions["session"]>;

const MIN_SECRET_LENGTH = 32;
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function createDatabaseHooks(database: Database, audience: Application): DatabaseHooks {
  return {
    session: {
      create: {
        before: async (
          candidate: Readonly<Record<string, unknown> & { userId: string }>,
          ctx: Readonly<{ path: string }> | null,
        ) => {
          const user = await findUser(database, candidate.userId);
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
  sendVerificationEmail: AuthOptions["sendVerificationEmail"],
  { audience, origin }: Readonly<{ audience: Application; origin: string }>,
): EmailVerificationOptions {
  return {
    autoSignInAfterVerification: false,
    sendOnSignIn: audience !== "wiki",
    sendOnSignUp: true,
    sendVerificationEmail: async ({
      user,
      token,
    }: Readonly<{ user: Readonly<{ email: string }>; token: string }>) => {
      const link = new URL("/verify-email", origin);
      link.hash = new URLSearchParams({ token }).toString();
      await sendVerificationEmail({ email: user.email, url: link.href });
    },
  };
}

function createLogger(onError: AuthOptions["onError"]): LoggerOptions {
  return {
    level: "warn",
    log: (level, _message, ...details: readonly unknown[]) => {
      if (level === "error" && onError) {
        onError(
          details.find((detail) => detail instanceof Error) ??
            new Error("Authentication operation failed"),
        );
        return;
      }
      // oxlint-disable-next-line no-console
      console.warn(JSON.stringify({ event: "authentication.diagnostic", level }));
    },
  };
}

function createAdvancedOptions(audience: Application, origin: string): AdvancedOptions {
  return {
    cookiePrefix: `template-${audience}`,
    crossSubDomainCookies: { enabled: false },
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
    minPasswordLength: 12,
    requireEmailVerification: true,
  };
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function createAuth(options: AuthOptions) {
  const { database, audience } = options;
  const { origin } = new URL(options.baseURL);
  if (options.secret.length < MIN_SECRET_LENGTH) {
    throw new Error("AUTH_SECRET_TOO_SHORT");
  }
  return betterAuth({
    advanced: createAdvancedOptions(audience, origin),
    appName: "TypeScript Template",
    baseURL: options.baseURL,
    database: drizzleAdapter(database, { provider: "sqlite", schema, transaction: false }),
    databaseHooks: createDatabaseHooks(database, audience),
    emailAndPassword: createEmailAndPassword(audience),
    emailVerification: createEmailVerification(options.sendVerificationEmail, {
      audience,
      origin,
    }),
    hooks: createRequestHooks(database, audience),
    logger: createLogger(options.onError),
    plugins: authPlugins({ audience, database, origin }),
    rateLimit: { enabled: true, max: 60, storage: "database", window: 60 },
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

type Auth = ReturnType<typeof createAuth>;

function assertAdminSession(
  role: string,
  strong: boolean,
  allowEnrollment: boolean | undefined,
): void {
  if (role !== "admin") {
    deny("ADMIN_REQUIRED");
  }
  if (allowEnrollment !== true && !strong) {
    deny("ADMIN_MFA_REQUIRED");
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function verifySession(options: VerifySessionOptions): Promise<VerifiedSession> {
  const session = await options.auth.api.getSession({
    headers: options.headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    throw new APIError("UNAUTHORIZED", { message: "SESSION_REQUIRED" });
  }
  const current = await getSessionSecurity(options.database, session.session.id, options.audience);
  if (current?.user.emailVerified !== true) {
    deny("SESSION_INVALID");
  }
  const strong = isStrongMethod(current.session.authenticationMethod);
  if (options.audience !== "user") {
    assertAdminSession(current.user.role, strong, options.allowEnrollment);
  }
  return { session: current.session, strong, user: current.user };
}

export { createAuth, verifySession };
export type { Auth, AuthOptions };
