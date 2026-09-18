import { Effect } from "effect";

import { handleAuthRequest, verifyEmailToken, verifySession } from "@repo/auth";
import type { EmailVerificationFailed } from "@repo/auth";
import { Telemetry, httpStatus, ingestBrowser } from "@repo/observability";

import { EmailVerificationRequest, EmailVerified, HealthView, SessionView } from "./contracts.ts";
import { DatabaseHealth } from "./database-health.ts";
import type { Failure } from "./failures.ts";
import { createApi, readJsonBody } from "./http.ts";
import type { ApiRoutes } from "./http.ts";
import type { AppServices } from "./index.ts";

const unavailable = { AuthFailure: "unexpected", DatabaseFailure: "unexpected" } as const;

const health = Effect.fn("health")(function* health() {
  yield* (yield* DatabaseHealth).check;
  const telemetry = yield* Telemetry;
  return { ok: true, release: telemetry.release, service: telemetry.serviceName } as const;
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function emailVerificationFailure(error: EmailVerificationFailed): Failure {
  return error.rateLimited
    ? { message: "しばらく待ってから再度お試しください。", status: httpStatus.tooManyRequests }
    : { message: "確認リンクが無効か、有効期限が切れています。", status: httpStatus.badRequest };
}

function sessionApi<Requirements = never>(api: ApiRoutes<AppServices | Requirements>) {
  return createApi("")
    .all("/auth/*", api.raw(handleAuthRequest, unavailable))
    .post("/telemetry", api.raw(ingestBrowser, {}))
    .get("/health", api.route(HealthView, health, unavailable))
    .get(
      "/session",
      api.route(SessionView, (request) => verifySession(request.headers, true), unavailable),
    );
}

function accountApi<Requirements = never>(api: ApiRoutes<AppServices | Requirements>) {
  return createApi("")
    .use(sessionApi(api))
    .post(
      "/verify-email",
      api.route(
        EmailVerified,
        (request) =>
          readJsonBody(EmailVerificationRequest, request).pipe(
            Effect.flatMap(({ token }) => verifyEmailToken(token, request.headers)),
          ),
        {
          ...unavailable,
          EmailVerificationFailed: (error) => emailVerificationFailure(error),
        },
      ),
    );
}

export { accountApi, sessionApi, unavailable };
