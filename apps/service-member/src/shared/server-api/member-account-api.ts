import { sendEmailChangeConfirmation, sendEmailChangeNotice, verifySession } from "@repo/auth";
import {
  acceptLatest,
  acceptRegistration,
  consentState,
  publishedDocument,
} from "@repo/db/agreement";
import {
  confirmEmailChange,
  leaveMember,
  listMemberMessages,
  restorationFor,
  restoreMember,
  stageEmailChange,
} from "@repo/db/member-lifecycle";
import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect, Schema } from "effect";

import {
  AgreementAccept,
  AgreementView,
  EmailChangeConfirm,
  EmailChangeConfirmed,
  EmailChangePending,
  EmailChangeRequest,
  LeaveRequest,
  LeaveResult,
  LegalQuery,
  MemberMessageList,
  PublishedAgreement,
  RestorationResult,
  RestorationView,
} from "#shared/contracts/index.ts";
import { agreementFailures, consentedSession } from "./member-access.ts";
import { OpsMail } from "./ops-mail.ts";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

class StrongAuthenticationRequired extends Schema.TaggedError<StrongAuthenticationRequired>()(
  "StrongAuthenticationRequired",
  {},
) {}

const failures = {
  ...unavailable,
  ...agreementFailures,
  AgreementMissing: {
    message: "公開中の規約がありません。",
    status: httpStatus.conflict,
  },
  AgreementVersionUnavailable: {
    message: "規約の版が見つかりません。",
    status: httpStatus.notFound,
  },
  EmailChangeUnavailable: (error: { readonly reason: "expired" | "same" | "taken" | "unknown" }) => ({
    message:
      error.reason === "same"
        ? "いまのメールアドレスと同じです。"
        : error.reason === "taken"
          ? "そのメールアドレスは使えません。"
          : error.reason === "expired"
            ? "確認のリンクの期限が切れています。"
            : "メールアドレスを変更できません。",
    status: error.reason === "unknown" ? httpStatus.notFound : httpStatus.conflict,
  }),
  EmailDeliveryFailed: "unexpected" as const,
  LeaveUnavailable: {
    message: "退会できません。",
    status: httpStatus.conflict,
  },
  RestorationUnavailable: {
    message: "復旧できる退会データはありません。",
    status: httpStatus.conflict,
  },
  StrongAuthenticationRequired: {
    message: "メールアドレスを変更するには、認証アプリかパスキーでログインし直してください。",
    status: httpStatus.forbidden,
  },
};

const confirmationUrl = (origin: string, token: string): string => {
  const url = new URL("/verify-email-change", origin);
  url.hash = new URLSearchParams({ token }).toString();
  return url.href;
};

function memberAccountApi(api: ApiRoutes<AppServices | OpsMail>) {
  return createApi("")
    .get(
      "/legal",
      api.route(
        PublishedAgreement,
        (request) =>
          Effect.gen(function* handle() {
            const { kind } = yield* readSearchParams(LegalQuery, request);
            return yield* publishedDocument(kind);
          }),
        failures,
      ),
    )
    .get(
      "/agreement",
      api.route(
        AgreementView,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return yield* consentState(user.id);
          }),
        failures,
      ),
    )
    .post(
      "/agreement",
      api.route(
        AgreementView,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const body = yield* readJsonBody(AgreementAccept, request);
            const now = new Date();
            return body.purpose === "registration"
              ? yield* acceptRegistration(user.id, now)
              : yield* acceptLatest({ acceptedAt: now, kind: body.kind, userId: user.id }).pipe(
                  Effect.andThen(consentState(user.id)),
                );
          }),
        failures,
      ),
    )
    .post(
      "/leave",
      api.route(
        LeaveResult,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const body = yield* readJsonBody(LeaveRequest, request);
            yield* leaveMember({ immediate: body.immediate, now: new Date(), userId: user.id });
            return { left: true as const };
          }),
        failures,
      ),
    )
    .get(
      "/restoration",
      api.route(
        RestorationView,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return yield* restorationFor(user.id, new Date());
          }),
        failures,
      ),
    )
    .post(
      "/restoration",
      api.route(
        RestorationResult,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            yield* readJsonBody(Schema.Struct({}), request);
            yield* restoreMember(user.id, new Date());
            return { restored: true as const };
          }),
        failures,
      ),
    )
    .get(
      "/messages",
      api.route(
        MemberMessageList,
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* consentedSession(request.headers);
            return { messages: yield* listMemberMessages(user.id) };
          }),
        failures,
      ),
    )
    .post(
      "/email-change",
      api.route(
        EmailChangePending,
        (request) =>
          Effect.gen(function* handle() {
            const current = yield* consentedSession(request.headers);
            if (!current.strong) {
              return yield* new StrongAuthenticationRequired();
            }
            const body = yield* readJsonBody(EmailChangeRequest, request);
            const staged = yield* stageEmailChange({
              nextEmail: body.email,
              now: new Date(),
              userId: current.user.id,
            });
            const mail = yield* OpsMail;
            yield* sendEmailChangeConfirmation(mail, {
              email: staged.nextEmail,
              url: confirmationUrl(mail.APP_ORIGIN, staged.token),
            });
            return { pending: true as const };
          }),
        failures,
      ),
    )
    .post(
      "/email-change-confirm",
      api.route(
        EmailChangeConfirmed,
        (request) =>
          Effect.gen(function* handle() {
            const body = yield* readJsonBody(EmailChangeConfirm, request);
            const confirmed = yield* confirmEmailChange(body.token, new Date());
            const mail = yield* OpsMail;
            yield* sendEmailChangeNotice(mail, {
              email: confirmed.previousEmail,
              nextEmail: confirmed.nextEmail,
              url: new URL("/login", mail.APP_ORIGIN).href,
            });
            return { email: confirmed.nextEmail };
          }),
        failures,
      ),
    );
}

export { memberAccountApi };
