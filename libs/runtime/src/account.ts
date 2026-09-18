import { Duration, Effect } from "effect";

import { handleAuthRequest, verifyEmailToken, verifySession } from "@repo/auth";
import type { EmailVerificationFailed } from "@repo/auth";
import { checkDatabase } from "@repo/db";
import { Telemetry, httpStatus, ingestBrowser } from "@repo/observability";

import { EmailVerificationRequest, EmailVerified, HealthView, SessionView } from "./contracts.ts";
import type { Failure } from "./failures.ts";
import { createApi, readJsonBody } from "./http.ts";
import type { ApiRoutes } from "./http.ts";
import type { AppServices } from "./index.ts";

const unavailable = { AuthFailure: "unexpected", DatabaseFailure: "unexpected" } as const;

const healthCacheWindow = Duration.minutes(1);

function healthHandler() {
  const isolate: { cachedDatabaseCheck?: ReturnType<typeof checkDatabase> } = {};
  return Effect.fn("health")(function* health() {
    isolate.cachedDatabaseCheck ??= yield* Effect.cachedWithTTL(checkDatabase(), healthCacheWindow);
    yield* isolate.cachedDatabaseCheck;
    const telemetry = yield* Telemetry;
    return { ok: true, release: telemetry.release, service: telemetry.serviceName } as const;
  });
}

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
    .get("/health", api.route(HealthView, healthHandler(), unavailable))
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
