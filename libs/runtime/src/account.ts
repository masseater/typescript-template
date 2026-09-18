import {
  handleAuthRequest,
  verifyEmailToken,
  verifySession,
  type EmailVerificationFailed,
} from "@template/auth";
import { checkDatabase } from "@template/db";
import { Telemetry, httpStatus, ingestBrowser } from "@template/observability";
import { Effect } from "effect";

import { EmailVerificationRequest, EmailVerified, HealthView, SessionView } from "./contracts.ts";
import { createApi, readJsonBody, type ApiRoutes } from "./http.ts";

import type { Failure } from "./failures.ts";
import type { AppServices } from "./index.ts";

const unavailable = { AuthFailure: "unexpected", DatabaseFailure: "unexpected" } as const;

const health = Effect.fn("health")(function* health() {
  yield* checkDatabase();
  const telemetry = yield* Telemetry;
  return { ok: true, release: telemetry.release, service: telemetry.serviceName } as const;
});

const emailVerificationFailure = (error: EmailVerificationFailed): Failure => {
  return error.rateLimited
    ? { message: "しばらく待ってから再度お試しください。", status: httpStatus.tooManyRequests }
    : { message: "確認リンクが無効か、有効期限が切れています。", status: httpStatus.badRequest };
};

const sessionApi = <Requirements = never>(api: ApiRoutes<AppServices | Requirements>) => {
  return createApi("")
    .all("/auth/*", api.raw(handleAuthRequest, unavailable))
    .post("/telemetry", api.raw(ingestBrowser, {}))
    .get("/health", api.route(HealthView, health, unavailable))
    .get(
      "/session",

      api.route(SessionView, (request) => verifySession(request.headers, true), unavailable),
    );
};

const accountApi = <Requirements = never>(api: ApiRoutes<AppServices | Requirements>) => {
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
};

export { accountApi, sessionApi, unavailable };
