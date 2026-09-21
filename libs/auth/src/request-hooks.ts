import {
  APPLICATION,
  AUTHENTICATION_METHOD,
  ROLE,
  loopbackHosts,
  type Application,
} from "@repo/config";
import {
  hasEnrolledFactor,
  hasVerificationAudience,
  lookupSessionByToken,
  markSessionStrong,
  revokeUserSessions,
} from "@repo/db";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { Predicate } from "effect";

import { emailChangePath } from "./email-change.ts";
import {
  deny,
  enrollmentPaths,
  isRecentlyStrong,
  isStrongMethod,
  sessionIsLive,
} from "./policy.ts";
import { emailChangeTarget } from "./verification-token.ts";

import type { BetterAuthOptions } from "better-auth";
import type { Run } from "./runner.ts";

type RequestHooks = NonNullable<BetterAuthOptions["hooks"]>;
type SessionRecord = NonNullable<Awaited<ReturnType<typeof runSessionLookup>>>;

const emailVerificationPath = "/verify-email";
const sessionRevokingPaths = new Set([
  "/change-password",
  "/two-factor/disable",
  "/passkey/delete-passkey",
]);
const factorRemovalPaths = new Set(["/two-factor/disable", "/passkey/delete-passkey"]);
const oauthQueryPaths = new Set(["/oauth2/authorize", "/oauth2/consent", "/oauth2/continue"]);

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

type HookScope = {
  readonly audience: Application;
  readonly ctx: HookContext;
  readonly run: Run;
};

const runSessionLookup = async function runSessionLookup({ ctx, run }: HookScope) {
  const token = await ctx.getSignedCookie(
    ctx.context.authCookies.sessionToken.name,
    ctx.context.secret,
  );
  if (typeof token !== "string" || token === "") {
    return null;
  }
  return (await run(lookupSessionByToken(token))) ?? null;
};

const currentSessionOf = async function currentSessionOf(scope: HookScope) {
  const { ctx, run } = scope;
  if (ctx.context.newSession) {
    return (await run(lookupSessionByToken(ctx.context.newSession.session.token))) ?? null;
  }
  return runSessionLookup(scope);
};

const totpUpgradableMethods: ReadonlySet<string> = new Set([
  AUTHENTICATION_METHOD.password,
  AUTHENTICATION_METHOD.passwordTotp,
]);

const markTotpSessionStrong = async function markTotpSessionStrong(
  scope: HookScope,
): Promise<void> {
  const sessionRecord = await currentSessionOf(scope);
  if (
    sessionRecord &&
    sessionIsLive(sessionRecord, scope.audience) &&
    totpUpgradableMethods.has(sessionRecord.session.authenticationMethod)
  ) {
    await scope.run(
      markSessionStrong({
        audience: scope.audience,
        method: AUTHENTICATION_METHOD.passwordTotp,
        sessionId: sessionRecord.session.id,
      }),
    );
  }
};

const revokeSessionsAfterFactorChange = async function revokeSessionsAfterFactorChange(
  scope: HookScope,
): Promise<void> {
  const sessionRecord = await currentSessionOf(scope);
  if (sessionRecord && sessionIsLive(sessionRecord, scope.audience)) {
    await scope.run(revokeUserSessions(sessionRecord.user.id));
  }
};

const isLoopbackHttpRedirect = function isLoopbackHttpRedirect(redirectCandidate: unknown): boolean {
  const url = typeof redirectCandidate === "string" ? URL.parse(redirectCandidate) : undefined;
  return url?.protocol === "http:" && loopbackHosts.includes(url.hostname);
};

const registersLoopbackClient = function registersLoopbackClient(
  path: string,
  fields: object,
): boolean {
  return (
    path === "/oauth2/register" &&
    !("application_type" in fields) &&
    "redirect_uris" in fields &&
    Array.isArray(fields.redirect_uris) &&
    fields.redirect_uris.length > 0 &&
    fields.redirect_uris.every((uri: unknown) => isLoopbackHttpRedirect(uri))
  );
};

const rejectUnsafeFields = function rejectUnsafeFields(
  hookRequest: Readonly<Pick<HookContext, "body" | "path">>,
): void {
  const requestBody: unknown = hookRequest.body;
  const fields = Predicate.isObject(requestBody) ? requestBody : {};
  if ("trustDevice" in fields && fields["trustDevice"] === true) {
    deny("TRUSTED_DEVICE_DISABLED");
  }
  if ("oauth_query" in fields && !oauthQueryPaths.has(hookRequest.path)) {
    deny("OAUTH_QUERY_NOT_ACCEPTED");
  }
  if (registersLoopbackClient(hookRequest.path, fields)) {
    Object.assign(fields, { application_type: "native" });
  }
  if (
    hookRequest.path === "/passkey/verify-registration" &&
    "createSession" in fields &&
    fields["createSession"] === true
  ) {
    deny("REGISTRATION_SESSION_DISABLED");
  }
};

const challengeCookieFor = function challengeCookieFor(
  path: string,
  signedIn: boolean,
): string | undefined {
  if (path.startsWith("/passkey/verify-")) {
    return "better-auth-passkey";
  }
  if (!signedIn && path.startsWith("/two-factor/verify-")) {
    return "two_factor";
  }
  return undefined;
};

const verifyChallengeAudience = async function verifyChallengeAudience(
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
};

type SessionPolicyInput = {
  readonly audience: Application;
  readonly path: string;
  readonly role: string;
  readonly strong: boolean;
  readonly userId: string;
};

const enforceAdminAccess = function enforceAdminAccess({
  audience,
  path,
  role,
  strong,
}: SessionPolicyInput): void {
  if (role === ROLE.administrator && path === "/two-factor/get-totp-uri" && !strong) {
    deny("ADMIN_MFA_REQUIRED");
  }
  if (audience === APPLICATION.user) {
    return;
  }
  if (role !== ROLE.administrator) {
    deny("ADMIN_REQUIRED");
  }
  if (!strong && !enrollmentPaths.has(path)) {
    deny("ADMIN_MFA_REQUIRED");
  }
};

const factorEnrollmentPaths = new Set([
  "/two-factor/enable",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
]);

const enforceFactorChanges = async function enforceFactorChanges(
  { audience, path, role, strong, userId }: SessionPolicyInput,
  run: Run,
): Promise<void> {
  if (role !== ROLE.administrator) {
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
};

const enforceSessionPolicy = function enforceSessionPolicy(
  { audience, ctx, run }: HookScope,
  sessionRecord: SessionRecord,
): Promise<void> {
  if (!sessionIsLive(sessionRecord, audience)) {
    deny("SESSION_INVALID");
  }
  if (ctx.path === emailChangePath && !isRecentlyStrong(sessionRecord.session)) {
    deny("STRONG_AUTH_REQUIRED");
  }
  const input = {
    audience,
    path: ctx.path,
    role: sessionRecord.user.role,
    strong: isStrongMethod(sessionRecord.session.authenticationMethod),
    userId: sessionRecord.user.id,
  };
  enforceAdminAccess(input);
  return enforceFactorChanges(input, run);
};

const confirmsEmailChange = function confirmsEmailChange(
  hookRequest: Readonly<Pick<HookContext, "path" | "query">>,
): boolean {
  const query: unknown = hookRequest.query;
  const token = Predicate.isObject(query) && "token" in query ? query['token'] : undefined;
  return (
    hookRequest.path === emailVerificationPath &&
    typeof token === "string" &&
    emailChangeTarget(token) !== undefined
  );
};

const notifyEmailChange = async function notifyEmailChange(
  scope: HookScope,
  onEmailChangeRequested: (email: string) => Promise<void>,
): Promise<void> {
  const sessionRecord = await currentSessionOf(scope);
  if (sessionRecord && sessionIsLive(sessionRecord, scope.audience)) {
    await onEmailChangeRequested(sessionRecord.user.email);
  }
};

const createRequestHooks = function createRequestHooks({
  audience,
  onEmailChangeRequested,
  run,
}: {
  readonly audience: Application;
  readonly onEmailChangeRequested: (email: string) => Promise<void>;
  readonly run: Run;
}): RequestHooks {
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
      if (ctx.path === emailChangePath) {
        await notifyEmailChange(scope, onEmailChangeRequested);
      }
    }),
    before: createAuthMiddleware(async (ctx) => {
      rejectUnsafeFields(ctx);
      const scope = { audience, ctx, run };
      const sessionRecord = await runSessionLookup(scope);
      const present = sessionRecord !== null && sessionRecord.session.expiresAt > new Date();
      await verifyChallengeAudience(scope, present);
      if (present) {
        await enforceSessionPolicy(scope, sessionRecord);
      } else if (confirmsEmailChange(ctx)) {
        deny("SESSION_REQUIRED");
      }
    }),
  };
};

export { createRequestHooks };
