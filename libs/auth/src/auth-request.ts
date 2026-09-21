import { httpStatus } from "@repo/observability";
import { Effect } from "effect";

import { AuthFailure } from "./auth-failure.ts";
import { Auth } from "./auth.ts";
import { EmailVerificationFailed } from "./email-verification-failed.ts";

import type { BetterAuthInstance } from "./create-auth.ts";

function authPromise<Value>(
  run: (instance: BetterAuthInstance) => Promise<Value>,
): Effect.Effect<Value, AuthFailure, Auth> {
  return Effect.gen(function* authPromiseProgram() {
    const { instance } = yield* Auth;
    return yield* Effect.tryPromise({
      catch: (cause) => new AuthFailure({ cause }),
      try: () => run(instance),
    });
  });
}

const handleAuthRequest = function handleAuthRequest(
  request: Request,
): Effect.Effect<Response, AuthFailure, Auth> {
  return authPromise((instance) => instance.handler(request));
};

const verifyEmailToken = Effect.fn("verifyEmailToken")(function* verifyEmailToken(
  token: string,
  headers: Headers,
) {
  const { instance } = yield* Auth;
  const baseURL = instance.options.baseURL;
  if (typeof baseURL !== "string") {
    return yield* new EmailVerificationFailed({ rateLimited: false });
  }
  const verification = new URL("/api/auth/verify-email", baseURL);
  verification.searchParams.set("token", token);
  const response = yield* handleAuthRequest(new Request(verification, { headers, method: "GET" }));
  const responseBody = response.body;
  if (responseBody !== null) {
    yield* Effect.promise(() => responseBody.cancel());
  }
  if (!response.ok) {
    return yield* new EmailVerificationFailed({
      rateLimited: response.status === httpStatus.tooManyRequests,
    });
  }
  return { verified: true } as const;
});

export { handleAuthRequest, verifyEmailToken };
