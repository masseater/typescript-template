import { httpStatus } from "@repo/observability";
import { Effect } from "effect";

import { AuthFailure } from "./auth-failure.ts";
import { Auth } from "./auth.ts";
import { EmailVerificationFailed } from "./email-verification-failed.ts";

import type { BetterAuthInstance } from "./create-auth.ts";

const authPromise = <Value>(
  run: (authInstance: BetterAuthInstance) => Promise<Value>,
): Effect.Effect<Value, AuthFailure, Auth> =>
  Effect.gen(function* authPromiseProgram() {
    const { instance: authInstance } = yield* Auth;
    return yield* Effect.tryPromise({
      catch: (cause) => new AuthFailure({ cause }),
      try: async () => run(authInstance),
    });
  });

const handleAuthRequest = (authRequest: Request): Effect.Effect<Response, AuthFailure, Auth> =>
  authPromise(async (authInstance) => authInstance.handler(authRequest));

const verifyEmailToken = Effect.fn("verifyEmailToken")(function* verifyEmailToken(
  token: string,
  headers: Headers,
) {
  const { instance: authInstance } = yield* Auth;
  const verification = new URL("/api/auth/verify-email", authInstance.options.baseURL);
  verification.searchParams.set("token", token);
  const authResponse = yield* handleAuthRequest(new Request(verification, { headers, method: "GET" }));
  yield* Effect.promise(async () => authResponse.body?.cancel());
  if (!authResponse.ok) {
    return yield* new EmailVerificationFailed({
      rateLimited: authResponse.status === httpStatus.tooManyRequests,
    });
  }
  return { verified: true } as const;
});

export { handleAuthRequest, verifyEmailToken };
