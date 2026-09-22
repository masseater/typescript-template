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
import { DateTime, Effect, Predicate } from "effect";

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
  readonly hookContext: HookContext;
  readonly run: Run;
};

const runSessionLookup = Effect.fn("runSessionLookup")(function* runSessionLookup({
  hookContext,
  run,
}: HookScope) {
  const token = yield* Effect.promise(() =>
    hookContext.getSignedCookie(hookContext.context.authCookies.sessionToken.name, hookContext.context.secret),
  );
  if (typeof token !== "string" || token === "") {
    return null;
  }
  return (yield* Effect.promise(() => run(lookupSessionByToken(token)))) ?? null;
});

const currentSessionOf = Effect.fn("currentSessionOf")(function* currentSessionOf(
  scope: HookScope,
) {
  const { hookContext, run } = scope;
  const issuedSession = hookContext.context.newSession;
  if (issuedSession) {
    return (yield* Effect.promise(() => run(lookupSessionByToken(issuedSession.session.token)))) ?? null;
  }
  return yield* runSessionLookup(scope);
});

const totpUpgradableMethods: ReadonlySet<string> = new Set([
  AUTHENTICATION_METHOD.password,
  AUTHENTICATION_METHOD.passwordTotp,
]);

const markTotpSessionStrong = Effect.fn("markTotpSessionStrong")(function* markTotpSessionStrong(
  scope: HookScope,
) {
  const sessionRecord = yield* currentSessionOf(scope);
  if (
    sessionRecord &&
    sessionIsLive(sessionRecord, scope.audience) &&
    totpUpgradableMethods.has(sessionRecord.session.authenticationMethod)
  ) {
    yield* Effect.promise(() =>
      scope.run(
        markSessionStrong({
          audience: scope.audience,
          method: AUTHENTICATION_METHOD.passwordTotp,
          sessionId: sessionRecord.session.id,
        }),
      ),
    );
  }
});

const revokeSessionsAfterFactorChange = Effect.fn("revokeSessionsAfterFactorChange")(
  function* revokeSessionsAfterFactorChange(scope: HookScope) {
    const sessionRecord = yield* currentSessionOf(scope);
    if (sessionRecord && sessionIsLive(sessionRecord, scope.audience)) {
      yield* Effect.promise(() => scope.run(revokeUserSessions(sessionRecord.user.id)));
    }
  },
);

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

const verifyChallengeAudience = Effect.fn("verifyChallengeAudience")(
  function* verifyChallengeAudience({ audience, hookContext, run }: HookScope, signedIn: boolean) {
    const challengeCookie = challengeCookieFor(hookContext.path, signedIn);
    if (challengeCookie === undefined) {
      return;
    }
    const cookie = hookContext.context.createAuthCookie(challengeCookie);
    const identifier = yield* Effect.promise(() =>
      hookContext.getSignedCookie(cookie.name, hookContext.context.secret),
    );
    if (
      typeof identifier !== "string" ||
      identifier === "" ||
      !(yield* Effect.promise(() => run(hasVerificationAudience(identifier, audience))))
    ) {
      deny("CHALLENGE_AUDIENCE_INVALID");
    }
  },
);

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

const enforceFactorChanges = Effect.fn("enforceFactorChanges")(function* enforceFactorChanges(
  { audience, path, role, strong, userId }: SessionPolicyInput,
  run: Run,
) {
  if (role !== ROLE.administrator) {
    return;
  }
  if (
    !strong &&
    factorEnrollmentPaths.has(path) &&
    (yield* Effect.promise(() => run(hasEnrolledFactor(userId, audience))))
  ) {
    deny("EXISTING_FACTOR_REQUIRED");
  }
  if (factorRemovalPaths.has(path)) {
    deny("ADMIN_FACTOR_REMOVAL_DISABLED");
  }
});

const enforceSessionPolicy = Effect.fn("enforceSessionPolicy")(function* enforceSessionPolicy(
  { audience, hookContext, run }: HookScope,
  sessionRecord: NonNullable<Effect.Success<ReturnType<typeof lookupSessionByToken>>>,
) {
  if (!sessionIsLive(sessionRecord, audience)) {
    deny("SESSION_INVALID");
  }
  if (hookContext.path === emailChangePath && !isRecentlyStrong(sessionRecord.session)) {
    deny("STRONG_AUTH_REQUIRED");
  }
  const input = {
    audience,
    path: hookContext.path,
    role: sessionRecord.user.role,
    strong: isStrongMethod(sessionRecord.session.authenticationMethod),
    userId: sessionRecord.user.id,
  };
  enforceAdminAccess(input);
  yield* enforceFactorChanges(input, run);
});

const confirmsEmailChange = function confirmsEmailChange(
  hookRequest: Readonly<Pick<HookContext, "path" | "query">>,
): boolean {
  const query: unknown = hookRequest.query;
  const token = Predicate.isObject(query) && "token" in query ? query["token"] : undefined;
  return (
    hookRequest.path === emailVerificationPath &&
    typeof token === "string" &&
    emailChangeTarget(token) !== undefined
  );
};

const notifyEmailChange = Effect.fn("notifyEmailChange")(function* notifyEmailChange(
  scope: HookScope,
  onEmailChangeRequested: (email: string) => Promise<void>,
) {
  const sessionRecord = yield* currentSessionOf(scope);
  if (sessionRecord && sessionIsLive(sessionRecord, scope.audience)) {
    yield* Effect.promise(() => onEmailChangeRequested(sessionRecord.user.email));
  }
});

const createRequestHooks = function createRequestHooks({
  audience,
  onEmailChangeRequested,
  run,
}: {
  readonly audience: Application;
  readonly onEmailChangeRequested: (email: string) => Promise<void>;
  readonly run: Run;
}): NonNullable<BetterAuthOptions["hooks"]> {
  return {
    after: createAuthMiddleware((hookContext) =>
      Effect.runPromise(
        Effect.gen(function* afterAuth() {
          if (hookContext.context.returned instanceof APIError) {
            return;
          }
          const scope = { audience, hookContext, run };
          if (hookContext.path === "/two-factor/verify-totp") {
            yield* markTotpSessionStrong(scope);
          }
          if (sessionRevokingPaths.has(hookContext.path)) {
            yield* revokeSessionsAfterFactorChange(scope);
          }
          if (hookContext.path === emailChangePath) {
            yield* notifyEmailChange(scope, onEmailChangeRequested);
          }
        }),
      ),
    ),
    before: createAuthMiddleware((hookContext) =>
      Effect.runPromise(
        Effect.gen(function* beforeAuth() {
          rejectUnsafeFields(hookContext);
          const scope = { audience, hookContext, run };
          const sessionRecord = yield* runSessionLookup(scope);
          const present =
            sessionRecord !== null &&
            sessionRecord.session.expiresAt.getTime() > DateTime.toEpochMillis(yield* DateTime.now);
          yield* verifyChallengeAudience(scope, present);
          if (present) {
            yield* enforceSessionPolicy(scope, sessionRecord);
          } else if (confirmsEmailChange(hookContext)) {
            deny("SESSION_REQUIRED");
          }
        }),
      ),
    ),
  };
};

export { createRequestHooks };
