import { APIError } from "better-auth/api";
import { Effect } from "effect";

import { AdminMfaRequired } from "./admin-mfa-required.ts";
import { AdminRequired } from "./admin-required.ts";
import { AuthFailure } from "./auth-failure.ts";
import { Auth } from "./auth.ts";
import { EmailVerificationFailed } from "./email-verification-failed.ts";
import { SessionInvalid } from "./session-invalid.ts";

import type { BetterAuthInstance } from "./create-auth.ts";

const authPromise = <Value>(
  run: (instance: BetterAuthInstance) => Promise<Value>,
): Effect.Effect<Value, AuthFailure, Auth> => {
  return Effect.gen(function* authPromiseProgram() {
    const { instance } = yield* Auth;
    return yield* Effect.tryPromise({
      catch: (cause) => new AuthFailure({ cause }),
      try: async () => run(instance),
    });
  });
};

const classifyDenial = (
  failure: AuthFailure,
): AuthFailure | SessionInvalid | AdminRequired | AdminMfaRequired => {
  const denial = failure.cause instanceof APIError ? failure.cause.body?.message : undefined;
  if (denial === "SESSION_INVALID") {
    return new SessionInvalid();
  }
  if (denial === "ADMIN_REQUIRED") {
    return new AdminRequired();
  }
  return denial === "ADMIN_MFA_REQUIRED" ? new AdminMfaRequired() : failure;
};

type AuthSession = Awaited<ReturnType<BetterAuthInstance["api"]["getSession"]>>;

const authSession = (
  headers: Headers,
): Effect.Effect<
  AuthSession,
  AuthFailure | SessionInvalid | AdminRequired | AdminMfaRequired,
  Auth
> => {
  return authPromise(async (instance): Promise<AuthSession> =>
    instance.api.getSession({ headers, query: { disableCookieCache: true } }),
  ).pipe(Effect.mapError(classifyDenial));
};

const handleAuthRequest = (request: Request): Effect.Effect<Response, AuthFailure, Auth> => {
  return authPromise(async (instance) => instance.handler(request));
};

const tooManyRequests = 429;

const verifyEmailToken = Effect.fn("verifyEmailToken")(function* verifyEmailToken(
  token: string,

  headers: Headers,
) {
  const { instance } = yield* Auth;
  const verification = new URL("/api/auth/verify-email", instance.options.baseURL);
  verification.searchParams.set("token", token);
  const response = yield* handleAuthRequest(new Request(verification, { headers, method: "GET" }));
  yield* Effect.promise(async () => response.body?.cancel());
  if (!response.ok) {
    return yield* new EmailVerificationFailed({ rateLimited: response.status === tooManyRequests });
  }
  return { verified: true } as const;
});

export { authSession, handleAuthRequest, verifyEmailToken };
