import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { passkey } from "@better-auth/passkey";
import { Database, schema } from "@template/db";
import type { Audience, DrizzleDatabase } from "@template/db";
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
import { Context, Effect, Layer, Schema } from "effect";

export interface AuthOptions {
  readonly baseURL: string;
  readonly secret: string;
  readonly audience: Audience;
  readonly sendVerificationEmail: (message: {
    readonly email: string;
    readonly url: string;
  }) => Effect.Effect<void, unknown>;
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

function createAuth(
  options: AuthOptions,
  database: DrizzleDatabase,
  run: <A, E>(effect: Effect.Effect<A, E, Database>) => Promise<A>,
) {
  const { audience } = options;
  const origin = new URL(options.baseURL).origin;
  return betterAuth({
    appName: "TypeScript Template",
    baseURL: options.baseURL,
    secret: options.secret,
    logger: {
      level: "warn",
      log: (level, _message, ...details: unknown[]) => {
        void run(
          level === "error"
            ? Effect.logError("authentication.failed", {
                cause: details.find((detail) => detail instanceof Error) ?? null,
              })
            : Effect.logWarning("authentication.diagnostic", { level }),
        );
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
        await run(options.sendVerificationEmail({ email: user.email, url: link.href }));
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
            const user = await run(findPasskeyUser(clientData.id, audience));
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
            const user = await run(findUser(candidate.userId));
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
          if (!identifier || !(await run(hasVerificationAudience(identifier, audience)))) {
            deny("CHALLENGE_AUDIENCE_INVALID");
          }
        }
        if (!session) return;
        const current = await run(getSessionSecurity(session.session.id, audience));
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
          (await run(hasEnrolledFactor(current.user.id, audience)))
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
            const current = await run(getSessionSecurity(session.session.id, audience));
            if (
              current &&
              ["password", "password_totp"].includes(current.session.authenticationMethod)
            ) {
              await run(markSessionStrong(current.session.id, audience, "password_totp"));
            }
          }
        }
        if (
          ["/change-password", "/two-factor/disable", "/passkey/delete-passkey"].includes(ctx.path)
        ) {
          const session =
            ctx.context.newSession ?? (await getSessionFromCtx(ctx, { disableCookieCache: true }));
          if (session) await run(revokeUserSessions(session.user.id));
        }
      }),
    },
  });
}

export type BetterAuthInstance = ReturnType<typeof createAuth>;

export class AuthFailure extends Schema.TaggedError<AuthFailure>()("AuthFailure", {
  cause: Schema.Defect(),
}) {}

export class SessionRequired extends Schema.TaggedError<SessionRequired>()("SessionRequired", {}) {}

export class SessionInvalid extends Schema.TaggedError<SessionInvalid>()("SessionInvalid", {}) {}

export class AdminRequired extends Schema.TaggedError<AdminRequired>()("AdminRequired", {}) {}

export class AdminMfaRequired extends Schema.TaggedError<AdminMfaRequired>()(
  "AdminMfaRequired",
  {},
) {}

export class Auth extends Context.Service<
  Auth,
  { readonly audience: Audience; readonly instance: BetterAuthInstance }
>()("@template/auth/Auth") {
  static layer(options: AuthOptions) {
    return Layer.effect(
      Auth,
      Effect.gen(function* () {
        const database = yield* Database;
        const context = yield* Effect.context<Database>();
        const run = <A, E>(effect: Effect.Effect<A, E, Database>) =>
          Effect.runPromiseWith(context)(effect);
        return Auth.of({
          audience: options.audience,
          instance: createAuth(options, database, run),
        });
      }),
    );
  }
}

const authPromise = <A>(run: (instance: BetterAuthInstance) => Promise<A>) =>
  Auth.use((auth) =>
    Effect.tryPromise({
      try: () => run(auth.instance),
      catch: (cause) => new AuthFailure({ cause }),
    }),
  );

const classifyDenial = (
  failure: AuthFailure,
): AuthFailure | SessionInvalid | AdminRequired | AdminMfaRequired => {
  const denial = failure.cause instanceof APIError ? failure.cause.body?.message : undefined;
  if (denial === "SESSION_INVALID") return new SessionInvalid();
  if (denial === "ADMIN_REQUIRED") return new AdminRequired();
  if (denial === "ADMIN_MFA_REQUIRED") return new AdminMfaRequired();
  return failure;
};

export const handleAuthRequest = (request: Request) =>
  authPromise((instance) => instance.handler(request));

export class EmailVerificationFailed extends Schema.TaggedError<EmailVerificationFailed>()(
  "EmailVerificationFailed",
  { rateLimited: Schema.Boolean },
) {}

export const verifyEmailToken = Effect.fn("verifyEmailToken")(function* (
  token: string,
  headers: Headers,
) {
  const { instance } = yield* Auth;
  const verification = new URL("/api/auth/verify-email", instance.options.baseURL);
  verification.searchParams.set("token", token);
  const response = yield* handleAuthRequest(new Request(verification, { method: "GET", headers }));
  yield* Effect.promise(async () => response.body?.cancel());
  if (!response.ok)
    return yield* new EmailVerificationFailed({ rateLimited: response.status === 429 });
  return { verified: true } as const;
});

export const verifySession = Effect.fn("verifySession")(function* (
  headers: Headers,
  allowEnrollment = false,
) {
  const { audience } = yield* Auth;
  const session = yield* authPromise((instance) =>
    instance.api.getSession({ headers, query: { disableCookieCache: true } }),
  ).pipe(Effect.mapError(classifyDenial));
  if (!session) return yield* new SessionRequired();
  const current = yield* getSessionSecurity(session.session.id, audience);
  if (!current || !current.user.emailVerified) return yield* new SessionInvalid();
  const strong = strongMethods.has(current.session.authenticationMethod);
  if (audience === "admin") {
    if (current.user.role !== "admin") return yield* new AdminRequired();
    if (!allowEnrollment && !strong) return yield* new AdminMfaRequired();
  }
  return { user: current.user, session: current.session, strong };
});
