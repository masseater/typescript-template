import { EmailVerificationRequest, EmailVerified, HealthView, SessionView } from "./contracts.ts";
import { Telemetry, httpStatus, ingestBrowser } from "@template/observability";
import { createApi, readJsonBody } from "./http.ts";
import { handleAuthRequest, verifyEmailToken, verifySession } from "@template/auth";
import type { ApiRoutes } from "./http.ts";
import type { AppServices } from "./index.ts";
import { Effect } from "effect";
import type { EmailVerificationFailed } from "@template/auth";
import type { Failure } from "./failures.ts";
import { checkDatabase } from "@template/db";

const unavailable = { AuthFailure: "unexpected", DatabaseFailure: "unexpected" } as const;

const health = Effect.fn("health")(function* health() {
  yield* checkDatabase();
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
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
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
        // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
        (request) =>
          readJsonBody(EmailVerificationRequest, request).pipe(
            Effect.flatMap(({ token }) => verifyEmailToken(token, request.headers)),
          ),
        {
          ...unavailable,
          // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
          EmailVerificationFailed: (error) => emailVerificationFailure(error),
        },
      ),
    );
}

export { accountApi, sessionApi, unavailable };
