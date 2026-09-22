import {
  AUTHENTICATION_METHOD,
  audienceRoles,
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
import { DateTime, Effect, Predicate, Result } from "effect";

import {
  deny,
  enrollmentPaths,
  isPrivilegedRole,
  isRecentlyStrong,
  isStrongMethod,
  sessionIsLive,
} from "./policy.ts";
import { emailChangePrevious, emailChangeTarget } from "./verification-token.ts";

import type { BetterAuthOptions } from "better-auth";
import type { Run } from "./runner.ts";

type RequestHooks = NonNullable<BetterAuthOptions["hooks"]>;
type SessionRecord = NonNullable<Effect.Success<ReturnType<typeof lookupSessionByToken>>>;

const emailChangePath = "/change-email";
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

const runSessionLookup = Effect.fn("runSessionLookup")(function* runSessionLookup({
  ctx,
  run,
}: HookScope) {
  const token = yield* Effect.promise(() =>
    ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret),
  );
  if (typeof token !== "string" || token === "") {
    return null;
  }
  return (yield* Effect.promise(() => run(lookupSessionByToken(token)))) ?? null;
});

const currentSessionOf = Effect.fn("currentSessionOf")(function* currentSessionOf(
  scope: HookScope,
) {
  const { ctx, run } = scope;
  const created = ctx.context.newSession;
  if (created) {
    return (yield* Effect.promise(() => run(lookupSessionByToken(created.session.token)))) ?? null;
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
  const current = yield* currentSessionOf(scope);
  if (
    current &&
    sessionIsLive(current, scope.audience) &&
    totpUpgradableMethods.has(current.session.authenticationMethod)
  ) {
    yield* Effect.promise(() =>
      scope.run(
        markSessionStrong({
          audience: scope.audience,
          method: AUTHENTICATION_METHOD.passwordTotp,
          sessionId: current.session.id,
        }),
      ),
    );
  }
});

const revokeSessionsAfterFactorChange = Effect.fn("revokeSessionsAfterFactorChange")(
  function* revokeSessionsAfterFactorChange(scope: HookScope) {
    const current = yield* currentSessionOf(scope);
    if (current && sessionIsLive(current, scope.audience)) {
      yield* Effect.promise(() => scope.run(revokeUserSessions(current.user.id)));
    }
  },
);

const isLoopbackHttpRedirect = function isLoopbackHttpRedirect(value: unknown): boolean {
  const url = typeof value === "string" ? URL.parse(value) : undefined;
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
  ctx: Readonly<Pick<HookContext, "body" | "path">>,
): void {
  const body: unknown = ctx.body;
  const fields = Predicate.isObject(body) ? body : {};
  if ("trustDevice" in fields && fields["trustDevice"] === true) {
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
  function* verifyChallengeAudience({ audience, ctx, run }: HookScope, signedIn: boolean) {
    const challengeCookie = challengeCookieFor(ctx.path, signedIn);
    if (challengeCookie === undefined) {
      return;
    }
    const cookie = ctx.context.createAuthCookie(challengeCookie);
    const identifier = yield* Effect.promise(() =>
      ctx.getSignedCookie(cookie.name, ctx.context.secret),
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
  if (isPrivilegedRole(role) && path === "/two-factor/get-totp-uri" && !strong) {
    deny("ADMIN_MFA_REQUIRED");
  }
  if (!isPrivilegedRole(audienceRoles[audience])) {
    return;
  }
  if (role !== audienceRoles[audience]) {
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
  if (!isPrivilegedRole(role)) {
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
  { audience, ctx, run }: HookScope,
  current: SessionRecord,
) {
  if (!sessionIsLive(current, audience)) {
    deny("SESSION_INVALID");
  }
  if (ctx.path === emailChangePath && !isRecentlyStrong(current.session)) {
    deny("STRONG_AUTH_REQUIRED");
  }
  const input = {
    audience,
    path: ctx.path,
    role: current.user.role,
    strong: isStrongMethod(current.session.authenticationMethod),
    userId: current.user.id,
  };
  enforceAdminAccess(input);
  yield* enforceFactorChanges(input, run);
});

const queryToken = function queryToken(
  ctx: Readonly<Pick<HookContext, "query">>,
): string | undefined {
  const query: unknown = ctx.query;
  const token = Predicate.isObject(query) && "token" in query ? query["token"] : undefined;
  return typeof token === "string" ? token : undefined;
};

const confirmsEmailChange = function confirmsEmailChange(
  ctx: Readonly<Pick<HookContext, "path" | "query">>,
): boolean {
  const token = queryToken(ctx);
  if (ctx.path !== emailVerificationPath || token === undefined) {
    return false;
  }
  const target = emailChangeTarget(token);
  return Result.isSuccess(target) && target.success !== undefined;
};

const notifyEmailChange = Effect.fn("notifyEmailChange")(function* notifyEmailChange(
  scope: HookScope,
  onEmailChangeRequested: (email: string) => Promise<void>,
) {
  const current = yield* currentSessionOf(scope);
  if (current && sessionIsLive(current, scope.audience)) {
    yield* Effect.promise(() => onEmailChangeRequested(current.user.email));
  }
});

const notifyEmailChangeCompleted = Effect.fn("notifyEmailChangeCompleted")(
  function* notifyEmailChangeCompleted(
    scope: HookScope,
    onEmailChangeCompleted: (email: string) => Promise<void>,
  ) {
    const token = queryToken(scope.ctx);
    if (token === undefined) {
      return;
    }
    const previous = emailChangePrevious(token);
    if (Result.isFailure(previous) || previous.success === undefined) {
      return;
    }
    yield* Effect.promise(() => onEmailChangeCompleted(previous.success));
  },
);

const createRequestHooks = function createRequestHooks({
  audience,
  onEmailChangeCompleted,
  onEmailChangeRequested,
  run,
}: {
  readonly audience: Application;
  readonly onEmailChangeCompleted: (email: string) => Promise<void>;
  readonly onEmailChangeRequested: (email: string) => Promise<void>;
  readonly run: Run;
}): RequestHooks {
  return {
    after: createAuthMiddleware((ctx) =>
      Effect.runPromise(
        Effect.gen(function* afterAuth() {
          if (ctx.context.returned instanceof APIError) {
            return;
          }
          const scope = { audience, ctx, run };
          if (ctx.path === "/two-factor/verify-totp") {
            yield* markTotpSessionStrong(scope);
          }
          if (sessionRevokingPaths.has(ctx.path)) {
            yield* revokeSessionsAfterFactorChange(scope);
          }
          if (ctx.path === emailChangePath) {
            yield* notifyEmailChange(scope, onEmailChangeRequested);
          }
          if (confirmsEmailChange(ctx)) {
            yield* notifyEmailChangeCompleted(scope, onEmailChangeCompleted);
          }
        }),
      ),
    ),
    before: createAuthMiddleware((ctx) =>
      Effect.runPromise(
        Effect.gen(function* beforeAuth() {
          rejectUnsafeFields(ctx);
          const scope = { audience, ctx, run };
          const current = yield* runSessionLookup(scope);
          const present =
            current !== null &&
            current.session.expiresAt.getTime() > DateTime.toEpochMillis(yield* DateTime.now);
          yield* verifyChallengeAudience(scope, present);
          if (present) {
            yield* enforceSessionPolicy(scope, current);
          } else if (confirmsEmailChange(ctx)) {
            deny("SESSION_REQUIRED");
          }
        }),
      ),
    ),
  };
};

export { createRequestHooks };
