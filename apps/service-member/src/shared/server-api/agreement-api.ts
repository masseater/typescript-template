import { AGREEMENT_KIND, httpStatus } from "@repo/config";
import {
  acceptAgreements,
  listAgreements,
  publishedAgreement,
  readSession,
  requireCurrentAgreements,
  sessionFailures,
  withdrawAgreement,
} from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  AgreementAcceptance,
  AgreementWithdrawal,
  AgreementsView,
  PublishedAgreementQuery,
  PublishedAgreementView,
} from "#shared/contracts/index.ts";
import { withdrawInterviewHistoryConsent } from "#shared/interview/server.ts";

import type { AgreementRequired } from "@repo/db";
import type { AppServices } from "@repo/runtime";
import type { ApiRoutes, Failure } from "@repo/runtime/http";

const agreementRequired = (error: AgreementRequired): Failure => ({
  details: { kinds: error.kinds },
  message: "最新の利用規約への同意が必要です。",
  status: httpStatus.preconditionRequired,
});

const failures = {
  ...sessionFailures,
  AgreementRequired: agreementRequired,
  AgreementVersionUnavailable: {
    message: "同意の対象となる規約が見つかりません。",
    status: httpStatus.notFound,
  },
  AgreementWithdrawalUnavailable: {
    message: "この同意は取り消せません。",
    status: httpStatus.conflict,
  },
  InterviewConflict: {
    message: "別の画面で会話が進んでいます。読み込み直してください。",
    status: httpStatus.conflict,
  },
} as const;

const listCurrent = Effect.fn("agreements.list")(function* listCurrent(request: Request) {
  return yield* listAgreements(request);
});

const accept = Effect.fn("agreements.accept")(function* accept(request: Request) {
  const { versionIds } = yield* readJsonBody(AgreementAcceptance, request);
  return yield* acceptAgreements(request, versionIds);
});

const published = Effect.fn("agreements.published")(function* published(request: Request) {
  const { kind } = yield* readSearchParams(PublishedAgreementQuery, request);
  return yield* publishedAgreement(kind);
});

const withdraw = Effect.fn("agreements.withdraw")(function* withdraw(request: Request) {
  const { kind } = yield* readJsonBody(AgreementWithdrawal, request);
  const view = yield* withdrawAgreement(request, kind);
  if (kind === AGREEMENT_KIND.interview_history) {
    const session = yield* readSession(request);
    yield* withdrawInterviewHistoryConsent(session.user.id);
  }
  return view;
});

function agreementApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .get("/agreements", ...api.route({ response: AgreementsView }, listCurrent, failures))
    .post("/agreements/accept", ...api.route({ response: AgreementsView }, accept, failures))
    .get(
      "/agreements/published",
      ...api.route({ response: PublishedAgreementView }, published, failures),
    )
    .post("/agreements/withdraw", ...api.route({ response: AgreementsView }, withdraw, failures));
}

const consentExempt = (request: Request): boolean => {
  const path = new URL(request.url).pathname.replace(/\/$/, "") || "/";
  const relative = path.startsWith("/api/") ? path.slice("/api".length) : path;
  if (
    relative.startsWith("/auth") ||
    relative.startsWith("/agreements") ||
    relative === "/session" ||
    relative === "/health" ||
    relative === "/telemetry" ||
    relative.startsWith("/invite") ||
    relative === "/contact" ||
    relative === "/flags" ||
    relative === "/leave" ||
    relative.startsWith("/recovery") ||
    relative.startsWith("/billing") ||
    relative.startsWith("/support")
  ) {
    return true;
  }
  return relative === "/onboarding" && request.method === "GET";
};

const enforceAgreements = Effect.fn("consent.gate")(function* enforceAgreements(request: Request) {
  if (consentExempt(request)) {
    return;
  }
  yield* requireCurrentAgreements(request).pipe(
    Effect.catchTags({
      SessionInvalid: () => Effect.void,
      SessionRequired: () => Effect.void,
    }),
  );
});

function consentGate(api: ApiRoutes<AppServices>) {
  return api.guard(enforceAgreements, failures);
}

export { agreementApi, consentGate };
