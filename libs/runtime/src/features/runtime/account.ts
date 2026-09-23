import {
  InviteRejected,
  acceptInvitation,
  handleAuthRequest,
  previewInvitation,
  verifyEmailToken,
  verifySession,
} from "@repo/auth";
import { httpStatus } from "@repo/config";
import { Telemetry, ingestBrowser } from "@repo/observability";
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
import { createApi, failureBy } from "./http.ts";

import type { EmailVerificationFailed } from "@repo/auth";
import type { Failure, FailureTable } from "./failures.ts";
import type { ApiRoutes } from "./http.ts";
import type { AppServices } from "./index.ts";

const forbidden = {
  message: "この操作は許可されていません。",
  status: httpStatus.forbidden,
} as const;
const authUnavailable = { AuthFailure: "unexpected" } as const;
const databaseUnavailable = { DatabaseFailure: "unexpected" } as const;
const unavailable = { ...authUnavailable, ...databaseUnavailable } as const;

const sessionFailures = {
  ...unavailable,
  AdminMfaRequired: forbidden,
  AdminRequired: forbidden,
  SessionInvalid: forbidden,
  SessionRequired: { message: "ログインしてください。", status: httpStatus.unauthorized },
} as const satisfies FailureTable<Effect.Error<ReturnType<typeof verifySession>>>;

const health = Effect.fn("health")(function* health() {
  yield* (yield* DatabaseHealth).check;
  const telemetry = yield* Telemetry;
  return { ok: true, release: telemetry.release, service: telemetry.serviceName } as const;
});

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

const inviteMessages = {
  missing: { message: "招待が無効か、有効期限が切れています。", status: httpStatus.notFound },
  pending: { message: "このメールアドレスには有効な招待があります。", status: httpStatus.conflict },
  registered: {
    message: "このメールアドレスは既に登録されています。",
    status: httpStatus.conflict,
  },
} as const;

const inviteRejected = failureBy(
  [httpStatus.notFound, httpStatus.conflict],
  (error: InviteRejected) => inviteMessages[error.reason],
);

const privileged = {
  ...sessionFailures,
  AdminStrongSessionRequired: forbidden,
  EmailDeliveryFailed: "unexpected",
  InviteRejected: inviteRejected,
  PermissionRequired: forbidden,
  TargetUnavailable: {
    message: "対象が存在しないか、操作権限が失効しています。",
    status: httpStatus.conflict,
  },
} as const;

const inviteFailures = { ...unavailable, InviteRejected: inviteRejected };

const openInvite = Effect.fn("openInvite")(function* openInvite(
  _request: Request,
  query: { readonly token: string },
) {
  const preview = yield* previewInvitation(query.token);
  if (preview === undefined) {
    return yield* new InviteRejected({ reason: "missing" });
  }
  return { email: preview.email, permission: preview.permission };
});

const acceptOpenInvite = Effect.fn("acceptOpenInvite")(function* acceptOpenInvite(
  _request: Request,
  acceptance: typeof InviteAcceptance.Type,
) {
  const created = yield* acceptInvitation(acceptance);
  return { accepted: true, email: created.email } as const;
});

function inviteApi<Requirements = never>(api: ApiRoutes<AppServices | Requirements>) {
  return createApi("")
    .get(
      "/invite",
      ...api.route(
        { query: InvitePreviewQuery, response: InvitePreview },
        openInvite,
        inviteFailures,
      ),
    )
    .post(
      "/invite",
      ...api.route(
        { body: InviteAcceptance, response: InviteAccepted },
        acceptOpenInvite,
        inviteFailures,
      ),
    );
}

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

export {
  accountApi,
  authUnavailable,
  databaseUnavailable,
  forbidden,
  inviteApi,
  privileged,
  sessionApi,
  sessionFailures,
  unavailable,
};
