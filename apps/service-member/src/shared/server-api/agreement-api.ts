import { verifySession } from "@repo/auth";
import { AGREEMENT_KIND, agreementPolicies } from "@repo/config";
import {
  AgreementVersionUnavailable,
  AgreementWithdrawalUnavailable,
  acceptAgreementVersions,
  acceptedAgreements,
  pendingAgreements,
  publishedAgreement,
  requireCurrentAgreements,
  withdrawAgreementKind,
} from "@repo/db";
import { httpStatus } from "@repo/observability";
import { sessionFailures } from "@repo/runtime/account";
import { createApi, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect, DateTime } from "effect";

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
};

const agreementsOf = Effect.fn("agreementsOf")(function* agreementsOf(userId: string) {
  const [pending, accepted] = yield* Effect.all([
    pendingAgreements(userId),
    acceptedAgreements(userId),
  ]);
  return {
    accepted: accepted.map((agreement) => ({
      ...agreement,
      acceptedAt: agreement.acceptedAt.getTime(),
    })),
    pending: pending.map((agreement) => ({
      ...agreement,
      publishedAt: agreement.publishedAt.getTime(),
    })),
  };
});

const listCurrent = Effect.fn("agreements.list")(function* listCurrent(request: Request) {
  const { user } = yield* verifySession(request.headers);
  return yield* agreementsOf(user.id);
});

const accept = Effect.fn("agreements.accept")(function* accept(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const { versionIds } = yield* readJsonBody(AgreementAcceptance, request);
  yield* acceptAgreementVersions({
    acceptedAt: DateTime.toDate(yield* DateTime.now),
    userId: user.id,
    versionIds,
  });
  return yield* agreementsOf(user.id);
});

const published = Effect.fn("agreements.published")(function* published(request: Request) {
  const { kind } = yield* readSearchParams(PublishedAgreementQuery, request);
  const found = yield* publishedAgreement(kind);
  if (found === null) {
    return yield* new AgreementVersionUnavailable();
  }
  return { ...found, publishedAt: found.publishedAt.getTime() };
});

const withdraw = Effect.fn("agreements.withdraw")(function* withdraw(request: Request) {
  const { user } = yield* verifySession(request.headers);
  const { kind } = yield* readJsonBody(AgreementWithdrawal, request);
  if (!agreementPolicies[kind].withdrawable) {
    return yield* new AgreementWithdrawalUnavailable();
  }
  yield* withdrawAgreementKind({ kind, userId: user.id });
  if (kind === AGREEMENT_KIND.interview_history) {
    yield* withdrawInterviewHistoryConsent(user.id);
  }
  return yield* agreementsOf(user.id);
});

function agreementApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .get("/agreements", ...api.route({ response: AgreementsView }, listCurrent, failures))
    .post("/agreements/accept", ...api.route({ response: AgreementsView }, accept, failures))
    .get("/agreements/published", ...api.route({ response: PublishedAgreementView }, published, failures))
    .post("/agreements/withdraw", ...api.route({ response: AgreementsView }, withdraw, failures));
}

const enforceAgreements = Effect.fn("consent.gate")(function* enforceAgreements(request: Request) {
  yield* verifySession(request.headers).pipe(
    Effect.flatMap(({ user }) => requireCurrentAgreements(user.id)),
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
