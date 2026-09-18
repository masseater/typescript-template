import { EmailVerificationRequest, EmailVerified, HealthView, SessionView } from "./contracts.ts";
import { Telemetry, httpStatus, ingestBrowser } from "@template/observability";
import { createApi, failureBy } from "./http.ts";
import { handleAuthRequest, verifyEmailToken, verifySession } from "@template/auth";
import type { ApiRoutes } from "./http.ts";
import type { AppServices } from "./index.ts";
import { Effect } from "effect";
import type { EmailVerificationFailed } from "@template/auth";
import type { Failure, FailureTable } from "./failures.ts";
import { checkDatabase } from "@template/db";

const forbidden = {
  message: "この操作は許可されていません。",
  status: httpStatus.forbidden,
} as const;
const authUnavailable = { AuthFailure: "unexpected" } as const;
const databaseUnavailable = { DatabaseFailure: "unexpected" } as const;

const sessionFailures = {
  ...authUnavailable,
  ...databaseUnavailable,
  AdminMfaRequired: forbidden,
  AdminRequired: forbidden,
  SessionInvalid: forbidden,
  SessionRequired: { message: "ログインしてください。", status: httpStatus.unauthorized },
} as const satisfies FailureTable<Effect.Error<ReturnType<typeof verifySession>>>;

const health = Effect.fn("health")(function* health() {
  yield* checkDatabase();
  const telemetry = yield* Telemetry;
  return { ok: true, release: telemetry.release, service: telemetry.serviceName } as const;
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function emailVerificationFailure(
  error: EmailVerificationFailed,
): Failure<typeof httpStatus.tooManyRequests | typeof httpStatus.badRequest> {
  return error.rateLimited
    ? { message: "しばらく待ってから再度お試しください。", status: httpStatus.tooManyRequests }
    : { message: "確認リンクが無効か、有効期限が切れています。", status: httpStatus.badRequest };
}

const verificationFailures = {
  ...authUnavailable,
  EmailVerificationFailed: failureBy(
    [httpStatus.tooManyRequests, httpStatus.badRequest],
    emailVerificationFailure,
  ),
};

function sessionApi<Requirements = never>(api: ApiRoutes<AppServices | Requirements>) {
  return createApi("")
    .all("/auth/*", ...api.raw(handleAuthRequest, authUnavailable))
    .post("/telemetry", ...api.raw(ingestBrowser, {}))
    .get("/health", ...api.route({ response: HealthView }, health, databaseUnavailable))
    .get(
      "/session",
      ...api.route(
        { response: SessionView },
        (request) => verifySession(request.headers, true),
        sessionFailures,
      ),
    );
}

function accountApi<Requirements = never>(api: ApiRoutes<AppServices | Requirements>) {
  return createApi("")
    .use(sessionApi(api))
    .post(
      "/verify-email",
      ...api.route(
        { body: EmailVerificationRequest, response: EmailVerified },
        (request, { token }) => verifyEmailToken(token, request.headers),
        verificationFailures,
      ),
    );
}

export { accountApi, authUnavailable, databaseUnavailable, forbidden, sessionApi, sessionFailures };
