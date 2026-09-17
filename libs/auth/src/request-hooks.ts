import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import type { Audience, Database } from "@template/db";
import { deny, enrollmentPaths, isStrongMethod } from "./policy.ts";
import {
  getSessionSecurity,
  hasEnrolledFactor,
  hasVerificationAudience,
  markSessionStrong,
  revokeUserSessions,
} from "@template/db/security";
import type { BetterAuthOptions } from "better-auth";

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];
type RequestHooks = NonNullable<BetterAuthOptions["hooks"]>;

interface HookScope {
  readonly audience: Audience;
  readonly ctx: HookContext;
  readonly database: Database;
}

interface SessionPolicyInput {
  readonly audience: Audience;
  readonly path: string;
  readonly role: string;
  readonly strong: boolean;
  readonly userId: string;
}

const totpUpgradableMethods = new Set(["password", "password_totp"]);
const sessionRevokingPaths = new Set([
  "/change-password",
  "/two-factor/disable",
  "/passkey/delete-passkey",
]);
const factorEnrollmentPaths = new Set([
  "/two-factor/enable",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
]);
const factorRemovalPaths = new Set(["/two-factor/disable", "/passkey/delete-passkey"]);

async function currentSessionOf(ctx: HookContext): ReturnType<typeof getSessionFromCtx> {
  const session =
    ctx.context.newSession ?? (await getSessionFromCtx(ctx, { disableCookieCache: true }));
  return session;
}

async function markTotpSessionStrong({ audience, ctx, database }: HookScope): Promise<void> {
  const session = await currentSessionOf(ctx);
  if (!session) {
    return;
  }
  const current = await getSessionSecurity(database, session.session.id, audience);
  if (current && totpUpgradableMethods.has(current.session.authenticationMethod)) {
    await markSessionStrong({
      audience,
      database,
      method: "password_totp",
      sessionId: current.session.id,
    });
  }
}

async function revokeSessionsAfterFactorChange({ ctx, database }: HookScope): Promise<void> {
  const session = await currentSessionOf(ctx);
  if (session) {
    await revokeUserSessions(database, session.user.id);
  }
}

function rejectUnsafeFields(ctx: HookContext): void {
  const body: unknown = ctx.body;
  const fields = typeof body === "object" && body !== null ? body : {};
  if ("trustDevice" in fields && fields.trustDevice === true) {
    deny("TRUSTED_DEVICE_DISABLED");
  }
  if (
    ctx.path === "/passkey/verify-registration" &&
    "createSession" in fields &&
    fields.createSession === true
  ) {
    deny("REGISTRATION_SESSION_DISABLED");
  }
}

function challengeCookieFor(path: string, signedIn: boolean): string | undefined {
  if (path.startsWith("/passkey/verify-")) {
    return "better-auth-passkey";
  }
  if (!signedIn && path.startsWith("/two-factor/verify-")) {
    return "two_factor";
  }
  return undefined;
}

async function verifyChallengeAudience(
  { audience, ctx, database }: HookScope,
  signedIn: boolean,
): Promise<void> {
  const challengeCookie = challengeCookieFor(ctx.path, signedIn);
  if (challengeCookie === undefined) {
    return;
  }
  const cookie = ctx.context.createAuthCookie(challengeCookie);
  const identifier = await ctx.getSignedCookie(cookie.name, ctx.context.secret);
  if (
    typeof identifier !== "string" ||
    identifier === "" ||
    !(await hasVerificationAudience(database, identifier, audience))
  ) {
    deny("CHALLENGE_AUDIENCE_INVALID");
  }
}

function enforceAdminAccess({ audience, path, role, strong }: SessionPolicyInput): void {
  if (role === "admin" && path === "/two-factor/get-totp-uri" && !strong) {
    deny("ADMIN_MFA_REQUIRED");
  }
  if (audience !== "admin") {
    return;
  }
  if (role !== "admin") {
    deny("ADMIN_REQUIRED");
  }
  if (!strong && !enrollmentPaths.has(path)) {
    deny("ADMIN_MFA_REQUIRED");
  }
}

async function enforceFactorChanges(
  { audience, path, role, strong, userId }: SessionPolicyInput,
  database: Database,
): Promise<void> {
  if (role !== "admin") {
    return;
  }
  if (
    !strong &&
    factorEnrollmentPaths.has(path) &&
    (await hasEnrolledFactor(database, userId, audience))
  ) {
    deny("EXISTING_FACTOR_REQUIRED");
  }
  if (factorRemovalPaths.has(path)) {
    deny("ADMIN_FACTOR_REMOVAL_DISABLED");
  }
}

async function enforceSessionPolicy(
  { audience, ctx, database }: HookScope,
  sessionId: string,
): Promise<void> {
  const current = await getSessionSecurity(database, sessionId, audience);
  if (current?.user.emailVerified !== true) {
    deny("SESSION_INVALID");
  }
  const input = {
    audience,
    path: ctx.path,
    role: current.user.role,
    strong: isStrongMethod(current.session.authenticationMethod),
    userId: current.user.id,
  };
  enforceAdminAccess(input);
  await enforceFactorChanges(input, database);
}

function createRequestHooks(database: Database, audience: Audience): RequestHooks {
  return {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.context.returned instanceof APIError) {
        return;
      }
      const scope = { audience, ctx, database };
      if (ctx.path === "/two-factor/verify-totp") {
        await markTotpSessionStrong(scope);
      }
      if (sessionRevokingPaths.has(ctx.path)) {
        await revokeSessionsAfterFactorChange(scope);
      }
    }),
    before: createAuthMiddleware(async (ctx) => {
      rejectUnsafeFields(ctx);
      const scope = { audience, ctx, database };
      const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
      await verifyChallengeAudience(scope, Boolean(session));
      if (session) {
        await enforceSessionPolicy(scope, session.session.id);
      }
    }),
  };
}

export { createRequestHooks };
