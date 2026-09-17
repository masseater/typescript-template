import type { Audience, Database } from "@template/db";
import { assertEligibleUser, authenticationMethodFor, deny, isStrongMethod } from "./policy.ts";
import { findPasskeyUser, findUser, getSessionSecurity } from "@template/db/security";
import { APIError } from "better-auth/api";
import type { BetterAuthOptions } from "better-auth";
import type { SessionSecurity } from "@template/db/security";
import { betterAuth } from "better-auth";
import { createRequestHooks } from "./request-hooks.ts";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { schema } from "@template/db";
import { twoFactor } from "better-auth/plugins";

interface AuthOptions {
  readonly database: Database;
  readonly baseURL: string;
  readonly secret: string;
  readonly audience: Audience;
  readonly sendVerificationEmail: (
    message: Readonly<{ email: string; url: string }>,
  ) => Promise<void>;
  readonly onError?: (error: unknown) => void;
}

interface VerifySessionOptions {
  readonly auth: Auth;
  readonly database: Database;
  readonly headers: Headers;
  readonly audience: Audience;
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
type AuthPlugin = NonNullable<BetterAuthOptions["plugins"]>[number];

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

function createDatabaseHooks(database: Database, audience: Audience): DatabaseHooks {
  return {
    session: {
      create: {
        before: async (candidate, ctx) => {
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
        before: async (user) => ({ data: { ...user, role: "user", securityVersion: 0 } }),
      },
    },
  };
}

function createEmailVerification(options: AuthOptions): EmailVerificationOptions {
  return {
    autoSignInAfterVerification: false,
    sendOnSignIn: true,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const link = new URL(url);
      link.searchParams.set("callbackURL", "/login");
      await options.sendVerificationEmail({ email: user.email, url: link.href });
    },
  };
}

function createLogger(onError: AuthOptions["onError"]): LoggerOptions {
  return {
    level: "warn",
    log: (level, _message, ...details: unknown[]) => {
      if (level === "error" && onError) {
        onError(
          details.find((detail) => detail instanceof Error) ??
            new Error("Authentication operation failed"),
        );
        return;
      }
      console.warn(JSON.stringify({ event: "authentication.diagnostic", level }));
    },
  };
}

function verificationAudiencePlugin(audience: Audience): AuthPlugin {
  const audienceField = {
    defaultValue: audience,
    input: false,
    required: true,
    type: "string",
  } as const;
  return {
    id: "verification-audience",
    schema: {
      passkey: { fields: { audience: audienceField } },
      verification: { fields: { audience: audienceField } },
    },
  };
}

function passkeyPlugin(
  origin: string,
  database: Database,
  audience: Audience,
): ReturnType<typeof passkey> {
  return passkey({
    authentication: {
      afterVerification: async ({ verification, clientData }) => {
        if (!verification.authenticationInfo.userVerified) {
          deny("PASSKEY_UV_REQUIRED");
        }
        assertEligibleUser(await findPasskeyUser(database, clientData.id, audience), audience);
      },
    },
    authenticatorSelection: { userVerification: "required" },
    origin,
    rpID: new URL(origin).hostname,
  });
}

function createAdvancedOptions(audience: Audience, origin: string): AdvancedOptions {
  return {
    cookiePrefix: `template-${audience}`,
    crossSubDomainCookies: { enabled: false },
    useSecureCookies: origin.startsWith("https:"),
  };
}

function createEmailAndPassword(audience: Audience): EmailAndPasswordOptions {
  return {
    disableSignUp: audience === "admin",
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: true,
  };
}

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
    emailVerification: createEmailVerification(options),
    hooks: createRequestHooks(database, audience),
    logger: createLogger(options.onError),
    plugins: [
      verificationAudiencePlugin(audience),
      twoFactor({ issuer: "TypeScript Template", skipVerificationOnEnable: false }),
      passkeyPlugin(origin, database, audience),
    ],
    rateLimit: { enabled: true, max: 60, storage: "database", window: 60 },
    secret: options.secret,
    session: {
      additionalFields: {
        audience: { defaultValue: audience, input: false, required: true, type: ["user", "admin"] },
        authenticatedAt: { input: false, required: false, type: "date" },
        authenticationMethod: {
          defaultValue: "password",
          input: false,
          required: true,
          type: ["password", "password_totp", "passkey_uv", "recovery"],
        },
        securityVersion: { defaultValue: -1, input: false, required: true, type: "number" },
      },
      cookieCache: { enabled: false },
      expiresIn: audience === "admin" ? ADMIN_SESSION_SECONDS : USER_SESSION_SECONDS,
      freshAge: FRESH_SESSION_SECONDS,
    },
    trustedOrigins: [origin],
    user: {
      additionalFields: {
        role: { defaultValue: "user", input: false, required: true, type: ["user", "admin"] },
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
  if (options.audience === "admin") {
    assertAdminSession(current.user.role, strong, options.allowEnrollment);
  }
  return { session: current.session, strong, user: current.user };
}

export { createAuth, verifySession };
export type { Auth, AuthOptions };
