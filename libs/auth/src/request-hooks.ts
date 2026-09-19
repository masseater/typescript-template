import { loopbackHosts } from "@repo/config";
import {
  hasEnrolledFactor,
  hasVerificationAudience,
  lookupSessionByToken,
  markSessionStrong,
  revokeUserSessions,
} from "@repo/db/security";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { deny, enrollmentPaths, isStrongMethod, sessionIsLive } from "./policy.ts";

import type { Application } from "@repo/config";
import type { BetterAuthOptions } from "better-auth";
import type { Run } from "./runner.ts";

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];
type RequestHooks = NonNullable<BetterAuthOptions["hooks"]>;
type SessionRecord = NonNullable<Awaited<ReturnType<typeof runSessionLookup>>>;

interface HookScope {
  readonly audience: Application;
  readonly ctx: HookContext;
  readonly run: Run;
}

interface SessionPolicyInput {
  readonly audience: Application;
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
const oauthQueryPaths = new Set(["/oauth2/authorize", "/oauth2/consent", "/oauth2/continue"]);

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function runSessionLookup({ ctx, run }: HookScope) {
  const token = await ctx.getSignedCookie(
    ctx.context.authCookies.sessionToken.name,
    ctx.context.secret,
  );
  if (typeof token !== "string" || token === "") {
    // oxlint-disable-next-line unicorn/no-null
    return null;
  }
  return run(lookupSessionByToken(token));
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function currentSessionOf(scope: HookScope) {
  const { ctx, run } = scope;
  if (ctx.context.newSession) {
    return run(lookupSessionByToken(ctx.context.newSession.session.token));
  }
  return runSessionLookup(scope);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function markTotpSessionStrong(scope: HookScope): Promise<void> {
  const current = await currentSessionOf(scope);
  if (
    current &&
    sessionIsLive(current, scope.audience) &&
    totpUpgradableMethods.has(current.session.authenticationMethod)
  ) {
    await scope.run(markSessionStrong(current.session.id, scope.audience, "password_totp"));
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function revokeSessionsAfterFactorChange(scope: HookScope): Promise<void> {
  const current = await currentSessionOf(scope);
  if (current && sessionIsLive(current, scope.audience)) {
    await scope.run(revokeUserSessions(current.user.id));
  }
}

function isLoopbackHttpRedirect(value: unknown): boolean {
  const url = typeof value === "string" ? URL.parse(value) : undefined;
  return url?.protocol === "http:" && loopbackHosts.includes(url.hostname);
}

function registersLoopbackClient(path: string, fields: object): boolean {
  return (
    path === "/oauth2/register" &&
    !("application_type" in fields) &&
    "redirect_uris" in fields &&
    Array.isArray(fields.redirect_uris) &&
    fields.redirect_uris.length > 0 &&
    fields.redirect_uris.every((uri: unknown) => isLoopbackHttpRedirect(uri))
  );
}

function rejectUnsafeFields(ctx: Readonly<Pick<HookContext, "body" | "path">>): void {
  const body: unknown = ctx.body;
  const fields = typeof body === "object" && body !== null ? body : {};
  if ("trustDevice" in fields && fields.trustDevice === true) {
    deny("TRUSTED_DEVICE_DISABLED");
  }
  if ("oauth_query" in fields && !oauthQueryPaths.has(ctx.path)) {
    deny("OAUTH_QUERY_NOT_ACCEPTED");
  }
  if (registersLoopbackClient(ctx.path, fields)) {
    Object.assign(fields, { application_type: "native" });
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
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  { audience, ctx, run }: HookScope,
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
    !(await run(hasVerificationAudience(identifier, audience)))
  ) {
    deny("CHALLENGE_AUDIENCE_INVALID");
  }
}

function enforceAdminAccess({ audience, path, role, strong }: SessionPolicyInput): void {
  if (role === "admin" && path === "/two-factor/get-totp-uri" && !strong) {
    deny("ADMIN_MFA_REQUIRED");
  }
  if (audience === "service-member") {
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
  run: Run,
): Promise<void> {
  if (role !== "admin") {
    return;
  }
  if (
    !strong &&
    factorEnrollmentPaths.has(path) &&
    (await run(hasEnrolledFactor(userId, audience)))
  ) {
    deny("EXISTING_FACTOR_REQUIRED");
  }
  if (factorRemovalPaths.has(path)) {
    deny("ADMIN_FACTOR_REMOVAL_DISABLED");
  }
}

function enforceSessionPolicy(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  { audience, ctx, run }: HookScope,
  current: SessionRecord,
): Promise<void> {
  if (!sessionIsLive(current, audience)) {
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
  return enforceFactorChanges(input, run);
}

function createRequestHooks(run: Run, audience: Application): RequestHooks {
  return {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.context.returned instanceof APIError) {
        return;
      }
      const scope = { audience, ctx, run };
      if (ctx.path === "/two-factor/verify-totp") {
        await markTotpSessionStrong(scope);
      }
      if (sessionRevokingPaths.has(ctx.path)) {
        await revokeSessionsAfterFactorChange(scope);
      }
    }),
    before: createAuthMiddleware(async (ctx) => {
      rejectUnsafeFields(ctx);
      const scope = { audience, ctx, run };
      const current = await runSessionLookup(scope);
      const present = current !== null && current.session.expiresAt > new Date();
      await verifyChallengeAudience(scope, present);
      if (present) {
        await enforceSessionPolicy(scope, current);
      }
    }),
  };
}

export { createRequestHooks };
