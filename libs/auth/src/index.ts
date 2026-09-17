import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { schema } from "@template/db";
import type { Audience, Database } from "@template/db";
import {
  findPasskeyUser,
  findUser,
  getSessionSecurity,
  hasEnrolledFactor,
  hasVerificationAudience,
  markSessionStrong,
  revokeUserSessions,
} from "@template/db/security";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";

export interface AuthOptions {
  database: Database;
  baseURL: string;
  secret: string;
  audience: Audience;
  sendVerificationEmail: (message: { email: string; url: string }) => Promise<void>;
  onError?: (error: unknown) => void;
}

const strongMethods = new Set(["password_totp", "passkey_uv"]);
const enrollmentPaths = new Set([
  "/get-session",
  "/sign-out",
  "/two-factor/enable",
  "/two-factor/verify-totp",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/list-user-passkeys",
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
]);

function deny(message: string): never {
  throw new APIError("FORBIDDEN", { message });
}

export function createAuth(options: AuthOptions) {
  const { database, audience } = options;
  const origin = new URL(options.baseURL).origin;
  if (options.secret.length < 32) throw new Error("AUTH_SECRET_TOO_SHORT");
  return betterAuth({
    appName: "TypeScript Template",
    baseURL: options.baseURL,
    secret: options.secret,
    logger: {
      level: "warn",
      log: (level, _message, ...details: unknown[]) => {
        if (level === "error" && options.onError)
          options.onError(
            details.find((detail) => detail instanceof Error) ??
              new Error("Authentication operation failed"),
          );
        else console.warn(JSON.stringify({ event: "authentication.diagnostic", level }));
      },
    },
    trustedOrigins: [origin],
    database: drizzleAdapter(database, { provider: "sqlite", schema, transaction: false }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      disableSignUp: audience === "admin",
      minPasswordLength: 12,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, token }) => {
        const link = new URL("/verify-email", origin);
        link.hash = new URLSearchParams({ token }).toString();
        await options.sendVerificationEmail({ email: user.email, url: link.href });
      },
    },
    user: {
      additionalFields: {
        role: { type: ["user", "admin"], required: true, defaultValue: "user", input: false },
        securityVersion: { type: "number", required: true, defaultValue: 0, input: false },
      },
      deleteUser: { enabled: false },
    },
    session: {
      cookieCache: { enabled: false },
      expiresIn: audience === "admin" ? 60 * 60 * 8 : 60 * 60 * 24 * 7,
      freshAge: 60 * 5,
      additionalFields: {
        audience: { type: ["user", "admin"], required: true, input: false, defaultValue: audience },
        securityVersion: { type: "number", required: true, input: false, defaultValue: -1 },
        authenticationMethod: {
          type: ["password", "password_totp", "passkey_uv", "recovery"],
          required: true,
          input: false,
          defaultValue: "password",
        },
        authenticatedAt: { type: "date", required: false, input: false },
      },
    },
    advanced: {
      cookiePrefix: `template-${audience}`,
      crossSubDomainCookies: { enabled: false },
      useSecureCookies: origin.startsWith("https:"),
    },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
    plugins: [
      {
        id: "verification-audience",
        schema: {
          verification: {
            fields: {
              audience: { type: "string", required: true, input: false, defaultValue: audience },
            },
          },
          passkey: {
            fields: {
              audience: { type: "string", required: true, input: false, defaultValue: audience },
            },
          },
        },
      },
      twoFactor({ issuer: "TypeScript Template", skipVerificationOnEnable: false }),
      passkey({
        origin,
        rpID: new URL(origin).hostname,
        authenticatorSelection: { userVerification: "required" },
        authentication: {
          afterVerification: async ({ verification, clientData }) => {
            if (!verification.authenticationInfo.userVerified) deny("PASSKEY_UV_REQUIRED");
            const user = await findPasskeyUser(database, clientData.id, audience);
            if (!user?.emailVerified) deny("VERIFIED_EMAIL_REQUIRED");
            if (audience === "admin" && user.role !== "admin") deny("ADMIN_REQUIRED");
          },
        },
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: (user) =>
            Promise.resolve({ data: { ...user, role: "user", securityVersion: 0 } }),
        },
      },
      session: {
        create: {
          before: async (candidate, ctx) => {
            const user = await findUser(database, candidate.userId);
            if (!user?.emailVerified) deny("VERIFIED_EMAIL_REQUIRED");
            if (audience === "admin" && user.role !== "admin") deny("ADMIN_REQUIRED");
            const authenticationMethod =
              ctx?.path === "/passkey/verify-authentication"
                ? "passkey_uv"
                : ctx?.path === "/two-factor/verify-totp"
                  ? "password_totp"
                  : ctx?.path === "/two-factor/verify-backup-code"
                    ? "recovery"
                    : "password";
            return {
              data: {
                ...candidate,
                audience,
                securityVersion: user.securityVersion,
                authenticationMethod,
                authenticatedAt: new Date(),
              },
            };
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const body: unknown = ctx.body;
        const fields = typeof body === "object" && body !== null ? body : {};
        if ("trustDevice" in fields && fields.trustDevice === true) deny("TRUSTED_DEVICE_DISABLED");
        if (
          ctx.path === "/passkey/verify-registration" &&
          "createSession" in fields &&
          fields.createSession === true
        ) {
          deny("REGISTRATION_SESSION_DISABLED");
        }
        const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
        const challengeCookie = ctx.path.startsWith("/passkey/verify-")
          ? "better-auth-passkey"
          : !session && ctx.path.startsWith("/two-factor/verify-")
            ? "two_factor"
            : null;
        if (challengeCookie) {
          const cookie = ctx.context.createAuthCookie(challengeCookie);
          const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
          if (!identifier || !(await hasVerificationAudience(database, identifier, audience))) {
            deny("CHALLENGE_AUDIENCE_INVALID");
          }
        }
        if (!session) return;
        const current = await getSessionSecurity(database, session.session.id, audience);
        if (!current || !current.user.emailVerified) deny("SESSION_INVALID");
        if (
          current.user.role === "admin" &&
          ctx.path === "/two-factor/get-totp-uri" &&
          !strongMethods.has(current.session.authenticationMethod)
        ) {
          deny("ADMIN_MFA_REQUIRED");
        }
        if (audience === "admin") {
          if (current.user.role !== "admin") deny("ADMIN_REQUIRED");
          if (
            !strongMethods.has(current.session.authenticationMethod) &&
            !enrollmentPaths.has(ctx.path)
          )
            deny("ADMIN_MFA_REQUIRED");
        }
        if (
          current.user.role === "admin" &&
          !strongMethods.has(current.session.authenticationMethod) &&
          [
            "/two-factor/enable",
            "/passkey/generate-register-options",
            "/passkey/verify-registration",
          ].includes(ctx.path) &&
          (await hasEnrolledFactor(database, current.user.id, audience))
        ) {
          deny("EXISTING_FACTOR_REQUIRED");
        }
        if (
          current.user.role === "admin" &&
          ["/two-factor/disable", "/passkey/delete-passkey"].includes(ctx.path)
        ) {
          deny("ADMIN_FACTOR_REMOVAL_DISABLED");
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.context.returned instanceof APIError) return;
        if (ctx.path === "/two-factor/verify-totp") {
          const session =
            ctx.context.newSession ?? (await getSessionFromCtx(ctx, { disableCookieCache: true }));
          if (session) {
            const current = await getSessionSecurity(database, session.session.id, audience);
            if (
              current &&
              ["password", "password_totp"].includes(current.session.authenticationMethod)
            ) {
              await markSessionStrong(database, current.session.id, audience, "password_totp");
            }
          }
        }
        if (
          ["/change-password", "/two-factor/disable", "/passkey/delete-passkey"].includes(ctx.path)
        ) {
          const session =
            ctx.context.newSession ?? (await getSessionFromCtx(ctx, { disableCookieCache: true }));
          if (session) await revokeUserSessions(database, session.user.id);
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

export async function verifySession(options: {
  auth: Auth;
  database: Database;
  headers: Headers;
  audience: Audience;
  allowEnrollment?: boolean;
}) {
  const session = await options.auth.api.getSession({
    headers: options.headers,
    query: { disableCookieCache: true },
  });
  if (!session) throw new APIError("UNAUTHORIZED", { message: "SESSION_REQUIRED" });
  const current = await getSessionSecurity(options.database, session.session.id, options.audience);
  if (!current || !current.user.emailVerified) deny("SESSION_INVALID");
  const strong = strongMethods.has(current.session.authenticationMethod);
  if (options.audience === "admin") {
    if (current.user.role !== "admin") deny("ADMIN_REQUIRED");
    if (!options.allowEnrollment && !strong) deny("ADMIN_MFA_REQUIRED");
  }
  return { user: current.user, session: current.session, strong };
}
