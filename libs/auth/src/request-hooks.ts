import {
  APPLICATION,
  AUTHENTICATION_METHOD,
  ROLE,
  loopbackHostSet,
  type Application,
} from "@template/config";
import {
  getSessionSecurity,
  hasEnrolledFactor,
  hasVerificationAudience,
  markSessionStrong,
  revokeUserSessions,
} from "@template/db/security";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";

import { deny, enrollmentPaths, isStrongMethod } from "./policy.ts";

import type { BetterAuthOptions } from "better-auth";
import type { Run } from "./runner.ts";

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

const currentSessionOf = async (hookContext: HookContext): ReturnType<typeof getSessionFromCtx> => {
  const signedIn =
    hookContext.context.newSession ??
    (await getSessionFromCtx(hookContext, { disableCookieCache: true }));
  return signedIn;
};

type HookScope = {
  readonly audience: Application;
  readonly hookContext: HookContext;
  readonly run: Run;
};

const totpUpgradableMethods: ReadonlySet<string> = new Set([
  AUTHENTICATION_METHOD.password,
  AUTHENTICATION_METHOD.passwordTotp,
]);

const markTotpSessionStrong = async ({ audience, hookContext, run }: HookScope): Promise<void> => {
  const signedIn = await currentSessionOf(hookContext);
  if (!signedIn) {
    return;
  }
  const liveSession = await run(getSessionSecurity(signedIn.session.id, audience));
  if (liveSession && totpUpgradableMethods.has(liveSession.session.authenticationMethod)) {
    await run(
      markSessionStrong({
        audience,
        method: AUTHENTICATION_METHOD.passwordTotp,
        sessionId: liveSession.session.id,
      }),
    );
  }
};

const revokeSessionsAfterFactorChange = async ({ hookContext, run }: HookScope): Promise<void> => {
  const signedIn = await currentSessionOf(hookContext);
  if (signedIn) {
    await run(revokeUserSessions(signedIn.user.id));
  }
};

const isLoopbackHttpRedirect = (redirectUri: unknown): boolean => {
  const url = typeof redirectUri === "string" ? URL.parse(redirectUri) : undefined;
  return url?.protocol === "http:" && loopbackHostSet.has(url.hostname);
};

const registersLoopbackClient = (path: string, fields: object): boolean => {
  return (
    path === "/oauth2/register" &&
    !("application_type" in fields) &&
    "redirect_uris" in fields &&
    Array.isArray(fields.redirect_uris) &&
    fields.redirect_uris.length > 0 &&
    fields.redirect_uris.every((uri: unknown) => isLoopbackHttpRedirect(uri))
  );
};

const oauthQueryPaths = new Set(["/oauth2/authorize", "/oauth2/consent", "/oauth2/continue"]);

const unsafeFieldDenial = (path: string, fields: object): string | undefined => {
  if ("trustDevice" in fields && fields.trustDevice === true) {
    return "TRUSTED_DEVICE_DISABLED";
  }
  if ("oauth_query" in fields && !oauthQueryPaths.has(path)) {
    return "OAUTH_QUERY_NOT_ACCEPTED";
  }
  return path === "/passkey/verify-registration" &&
    "createSession" in fields &&
    fields.createSession === true
    ? "REGISTRATION_SESSION_DISABLED"
    : undefined;
};

const checkedBody = (
  hookContext: Readonly<Pick<HookContext, "body" | "path">>,
): { readonly context: { readonly body: object } } | undefined => {
  const requestBody: unknown = hookContext.body;
  const fields = typeof requestBody === "object" && requestBody !== null ? requestBody : {};
  const denialCode = unsafeFieldDenial(hookContext.path, fields);
  if (denialCode !== undefined) {
    deny(denialCode);
  }
  return registersLoopbackClient(hookContext.path, fields)
    ? { context: { body: { ...fields, application_type: "native" } } }
    : undefined;
};

const challengeCookieFor = (path: string, signedIn: boolean): string | undefined => {
  if (path.startsWith("/passkey/verify-")) {
    return "better-auth-passkey";
  }
  if (!signedIn && path.startsWith("/two-factor/verify-")) {
    return "two_factor";
  }
  return undefined;
};

const verifyChallengeAudience = async (
  { audience, hookContext, run }: HookScope,
  signedIn: boolean,
): Promise<void> => {
  const challengeCookie = challengeCookieFor(hookContext.path, signedIn);
  if (challengeCookie === undefined) {
    return;
  }
  const cookie = hookContext.context.createAuthCookie(challengeCookie);
  const identifier = await hookContext.getSignedCookie(cookie.name, hookContext.context.secret);
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

const enforceAdminAccess = ({ audience, path, role, strong }: SessionPolicyInput): void => {
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
const factorRemovalPaths = new Set(["/two-factor/disable", "/passkey/delete-passkey"]);

const enforceFactorChanges = async (
  { audience, path, role, strong, userId }: SessionPolicyInput,
  run: Run,
): Promise<void> => {
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

const enforceSessionPolicy = async (
  { audience, hookContext, run }: HookScope,
  sessionId: string,
): Promise<void> => {
  const liveSession = await run(getSessionSecurity(sessionId, audience));
  if (liveSession?.user.emailVerified !== true) {
    deny("SESSION_INVALID");
  }
  const policyInput = {
    audience,
    path: hookContext.path,
    role: liveSession.user.role,
    strong: isStrongMethod(liveSession.session.authenticationMethod),
    userId: liveSession.user.id,
  };
  enforceAdminAccess(policyInput);
  await enforceFactorChanges(policyInput, run);
};

const sessionRevokingPaths = new Set([
  "/change-password",
  "/two-factor/disable",
  "/passkey/delete-passkey",
]);

export const createRequestHooks = (
  run: Run,
  audience: Application,
): NonNullable<BetterAuthOptions["hooks"]> => {
  return {
    after: createAuthMiddleware(async (hookContext) => {
      if (hookContext.context.returned instanceof APIError) {
        return;
      }
      const scope = { audience, hookContext, run };
      if (hookContext.path === "/two-factor/verify-totp") {
        await markTotpSessionStrong(scope);
      }
      if (sessionRevokingPaths.has(hookContext.path)) {
        await revokeSessionsAfterFactorChange(scope);
      }
    }),

    before: createAuthMiddleware(async (hookContext) => {
      const bodyOverride = checkedBody(hookContext);
      const scope = { audience, hookContext, run };
      const signedIn = await getSessionFromCtx(hookContext, { disableCookieCache: true });
      await verifyChallengeAudience(scope, Boolean(signedIn));
      if (signedIn) {
        await enforceSessionPolicy(scope, signedIn.session.id);
      }
      return bodyOverride;
    }),
  };
};
