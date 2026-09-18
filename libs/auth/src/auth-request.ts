import { httpStatus } from "@template/observability";
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
  run: (betterAuthInstance: BetterAuthInstance) => Promise<Value>,
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

export const authSession = (
  headers: Headers,
): Effect.Effect<
  AuthSession,
  AuthFailure | SessionInvalid | AdminRequired | AdminMfaRequired,
  Auth
> => {
  return authPromise(async (betterAuthInstance): Promise<AuthSession> =>
    betterAuthInstance.api.getSession({ headers, query: { disableCookieCache: true } }),
  ).pipe(Effect.mapError(classifyDenial));
};

export const handleAuthRequest = (
  incoming: Request,
): Effect.Effect<Response, AuthFailure, Auth> => {
  return authPromise(async (betterAuthInstance) => betterAuthInstance.handler(incoming));
};

export const verifyEmailToken = Effect.fn("verifyEmailToken")(function* verifyEmailToken(
  token: string,
  headers: Headers,
) {
  const { instance } = yield* Auth;
  const verification = new URL(
    `/api/auth/verify-email?${new URLSearchParams({ token }).toString()}`,
    instance.options.baseURL,
  );
  const verificationResponse = yield* handleAuthRequest(
    new Request(verification, { headers, method: "GET" }),
  );
  yield* Effect.promise(async () => verificationResponse.body?.cancel());
  if (!verificationResponse.ok) {
    return yield* new EmailVerificationFailed({
      rateLimited: verificationResponse.status === httpStatus.tooManyRequests,
    });
  }
  return { verified: true } as const;
});
