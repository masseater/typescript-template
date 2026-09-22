import { httpStatus } from "@repo/config";
import { EmailVerificationFailed, InviteRejected } from "@repo/core-api";
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
import { CoreHealth } from "./core-health.ts";
import {
  acceptInvite as acceptInviteThroughCore,
  forwardAuth,
  previewInvite as previewInviteThroughCore,
  readSession,
  verifyEmail as verifyEmailThroughCore,
} from "./core.ts";
import { createApi, failureBy } from "./http.ts";

import type { InviteRpcError, SessionRpcError, VerifyEmailRpcError } from "./core.ts";
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
const coreUnavailable = { RpcClientError: "unexpected" } as const;

const sessionFailures = {
  ...coreUnavailable,
  SessionInvalid: forbidden,
  SessionRequired: { message: "ログインしてください。", status: httpStatus.unauthorized },
} as const satisfies FailureTable<SessionRpcError>;

const healthFailures = {
  ...databaseUnavailable,
  ...coreUnavailable,
} as const;

const health = Effect.fn("health")(function* health() {
  yield* (yield* CoreHealth).check;
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
  ...coreUnavailable,
  EmailVerificationFailed: failureBy(
    [httpStatus.tooManyRequests, httpStatus.badRequest],
    emailVerificationFailure,
  ),
} as const satisfies FailureTable<VerifyEmailRpcError>;

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
  AdminMfaRequired: forbidden,
  AdminRequired: forbidden,
  AdminStrongSessionRequired: forbidden,
  EmailDeliveryFailed: "unexpected",
  InviteRejected: inviteRejected,
  PermissionRequired: forbidden,
  TargetUnavailable: {
    message: "対象が存在しないか、操作権限が失効しています。",
    status: httpStatus.conflict,
  },
  ...unavailable,
} as const;

const inviteFailures = {
  ...coreUnavailable,
  InviteRejected: inviteRejected,
} as const satisfies FailureTable<InviteRpcError>;

const openInvite = Effect.fn("openInvite")(function* openInvite(
  _request: Request,
  query: { readonly token: string },
) {
  return yield* previewInviteThroughCore(query.token);
});

const acceptOpenInvite = Effect.fn("acceptOpenInvite")(function* acceptOpenInvite(
  _request: Request,
  acceptance: typeof InviteAcceptance.Type,
) {
  return yield* acceptInviteThroughCore(acceptance);
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
    .all("/auth/*", ...api.raw(forwardAuth, {}))
    .post("/telemetry", ...api.raw(ingestBrowser, {}))
    .get("/health", ...api.route({ response: HealthView }, health, healthFailures))
    .get(
      "/session",
      ...api.route({ response: SessionView }, (request) => readSession(request), sessionFailures),
    );
}

function accountApi<Requirements = never>(api: ApiRoutes<AppServices | Requirements>) {
  return createApi("")
    .use(sessionApi(api))
    .post(
      "/verify-email",
      ...api.route(
        { body: EmailVerificationRequest, response: EmailVerified },
        (request, { token }) => verifyEmailThroughCore(request, token),
        verificationFailures,
      ),
    );
}

export {
  accountApi,
  authUnavailable,
  databaseUnavailable,
  forbidden,
  forwardAuth,
  inviteApi,
  privileged,
  readSession,
  sessionApi,
  sessionFailures,
  unavailable,
};
export {
  Core,
  acceptAgreements,
  listAgreements,
  publishedAgreement,
  requireCurrentAgreements,
  withdrawAgreement,
} from "./core.ts";
