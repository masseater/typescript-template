import {
  InviteRejected,
  acceptInvitation,
  handleAuthRequest,
  previewInvitation,
  verifyEmailToken,
  verifySession,
} from "@repo/auth";
import { Telemetry, httpStatus, ingestBrowser } from "@repo/observability";
import { Effect } from "effect";

import {
  EmailVerificationRequest,
  EmailVerified,
  HealthView,
  InviteAcceptance,
  InviteAccepted,
  InvitePreview,
  InvitePreviewQuery,
  SessionView,
} from "./contracts.ts";
import { DatabaseHealth } from "./database-health.ts";
import { createApi, readJsonBody, readSearchParams } from "./http.ts";

import type { EmailVerificationFailed } from "@repo/auth";
import type { Failure } from "./failures.ts";
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function inviteFailure(error: InviteRejected): Failure {
  return error.reason === "registered"
    ? { message: "このメールアドレスは既に登録されています。", status: httpStatus.conflict }
    : { message: "招待が無効か、有効期限が切れています。", status: httpStatus.notFound };
}

const openInvite = Effect.fn("openInvite")(function* openInvite(request: Request) {
  const { token } = yield* readSearchParams(InvitePreviewQuery, request);
  const preview = yield* previewInvitation(token);
  if (preview === null) {
    return yield* new InviteRejected({ reason: "missing" });
  }
  return { email: preview.email, permission: preview.permission };
});

const acceptOpenInvite = Effect.fn("acceptOpenInvite")(function* acceptOpenInvite(
  request: Request,
) {
  const acceptance = yield* readJsonBody(InviteAcceptance, request);
  const created = yield* acceptInvitation(acceptance);
  return { accepted: true, email: created.email } as const;
});

function inviteApi<Requirements = never>(api: ApiRoutes<AppServices | Requirements>) {
  const failures = {
    ...unavailable,
    InviteRejected: (error: InviteRejected) => inviteFailure(error),
  };
  return createApi("")
    .get("/invite", api.route(InvitePreview, openInvite, failures))
    .post("/invite", api.route(InviteAccepted, acceptOpenInvite, failures));
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

export { accountApi, inviteApi, sessionApi, unavailable };
