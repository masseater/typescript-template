import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { mcp } from "@better-auth/mcp";
import { passkey } from "@better-auth/passkey";
import { schema } from "@template/db";
import {
  applications,
  authenticationMethods,
  roles,
  strongAuthenticationMethods,
} from "@template/config";
import type { Application } from "@template/config";
import type { Database } from "@template/db";
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
import { jwt, twoFactor } from "better-auth/plugins";
import { wikiScopes } from "./mcp.ts";

export interface AuthOptions {
  database: Database;
  baseURL: string;
  secret: string;
  audience: Application;
  sendVerificationEmail: (message: { email: string; url: string }) => Promise<void>;
  onError?: (error: unknown) => void;
}

const strongMethods = new Set<string>(strongAuthenticationMethods);
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
const oauthQueryPaths = new Set(["/oauth2/authorize", "/oauth2/consent", "/oauth2/continue"]);

function deny(message: string): never {
  throw new APIError("FORBIDDEN", { message });
}

function isLoopbackHttpRedirect(value: unknown) {
  if (typeof value !== "string" || !URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

function wikiAuthorizationServer(origin: string) {
  return [
    jwt({ disableSettingJwtHeader: true }),
    mcp({
      resource: `${origin}/mcp`,
      loginPage: "/login",
      consentPage: "/consent",
      scopes: [...wikiScopes],
      clientRegistrationDefaultScopes: [...wikiScopes],
      clientRegistrationAllowedScopes: [...wikiScopes],
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
    }),
  ];
}

export function createAuth(options: AuthOptions) {
  const { database, audience } = options;
  const privileged = audience !== "user";
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
      disableSignUp: privileged,
      minPasswordLength: 12,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: audience !== "wiki",
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, token }) => {
        const link = new URL("/verify-email", origin);
        link.hash = new URLSearchParams({ token }).toString();
        await options.sendVerificationEmail({ email: user.email, url: link.href });
      },
    },
    user: {
      additionalFields: {
        role: { type: [...roles], required: true, defaultValue: "user", input: false },
        securityVersion: { type: "number", required: true, defaultValue: 0, input: false },
      },
      deleteUser: { enabled: false },
    },
    session: {
      cookieCache: { enabled: false },
      expiresIn: privileged ? 60 * 60 * 8 : 60 * 60 * 24 * 7,
      freshAge: 60 * 5,
      additionalFields: {
        audience: {
          type: [...applications],
          required: true,
          input: false,
          defaultValue: audience,
        },
        securityVersion: { type: "number", required: true, input: false, defaultValue: -1 },
        authenticationMethod: {
          type: [...authenticationMethods],
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
            if (privileged && user.role !== "admin") deny("ADMIN_REQUIRED");
          },
        },
      }),
      ...(audience === "wiki" ? wikiAuthorizationServer(origin) : []),
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
            if (privileged && user.role !== "admin") deny("ADMIN_REQUIRED");
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
        if ("oauth_query" in fields && !oauthQueryPaths.has(ctx.path))
          deny("OAUTH_QUERY_NOT_ACCEPTED");
        if (
          ctx.path === "/oauth2/register" &&
          !("application_type" in fields) &&
          "redirect_uris" in fields &&
          Array.isArray(fields.redirect_uris) &&
          fields.redirect_uris.length > 0 &&
          fields.redirect_uris.every(isLoopbackHttpRedirect)
        )
          Object.assign(fields, { application_type: "native" });
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
        if (privileged) {
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
  audience: Application;
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
  if (options.audience !== "user") {
    if (current.user.role !== "admin") deny("ADMIN_REQUIRED");
    if (!options.allowEnrollment && !strong) deny("ADMIN_MFA_REQUIRED");
  }
  return { user: current.user, session: current.session, strong };
}
