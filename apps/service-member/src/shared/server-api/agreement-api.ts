import { verifySession } from "@repo/auth";
import {
  AgreementVersionUnavailable,
  acceptAgreementVersions,
  acceptedAgreements,
  pendingAgreements,
  publishedAgreement,
  requireCurrentAgreements,
} from "@repo/db";
import { httpStatus } from "@repo/observability";
import { unavailable } from "@repo/runtime/account";
import { createApi, failureBy, readJsonBody, readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import {
  AgreementAcceptance,
  AgreementsView,
  PublishedAgreementQuery,
  PublishedAgreementView,
} from "#shared/contracts/index.ts";

import type { AgreementRequired } from "@repo/db";
import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const agreementRequired = failureBy(
  [httpStatus.preconditionRequired],
  (error: AgreementRequired) => ({
    details: { kinds: error.kinds },
    message: "最新の利用規約への同意が必要です。",
    status: httpStatus.preconditionRequired,
  }),
);

const failures = {
  ...unavailable,
  AgreementRequired: agreementRequired,
  AgreementVersionUnavailable: {
    message: "同意の対象となる規約が見つかりません。",
    status: httpStatus.notFound,
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

function agreementApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .get(
      "/agreements",
      ...api.route(
        { response: AgreementsView },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            return yield* agreementsOf(user.id);
          }),
        failures,
      ),
    )
    .post(
      "/agreements/accept",
      ...api.route(
        { response: AgreementsView },
        (request) =>
          Effect.gen(function* handle() {
            const { user } = yield* verifySession(request.headers);
            const { versionIds } = yield* readJsonBody(AgreementAcceptance, request);
            yield* acceptAgreementVersions({ acceptedAt: new Date(), userId: user.id, versionIds });
            return yield* agreementsOf(user.id);
          }),
        failures,
      ),
    )
    .get(
      "/agreements/published",
      ...api.route(
        { response: PublishedAgreementView },
        (request) =>
          Effect.gen(function* handle() {
            const { kind } = yield* readSearchParams(PublishedAgreementQuery, request);
            const published = yield* publishedAgreement(kind);
            if (published === null) {
              return yield* new AgreementVersionUnavailable();
            }
            return { ...published, publishedAt: published.publishedAt.getTime() };
          }),
        failures,
      ),
    );
}

function consentGate(api: ApiRoutes<AppServices>) {
  return api.guard(
    (request) =>
      verifySession(request.headers).pipe(
        Effect.flatMap(({ user }) => requireCurrentAgreements(user.id)),
        Effect.catchTags({
          SessionInvalid: () => Effect.void,
          SessionRequired: () => Effect.void,
        }),
      ),
    failures,
  );
}

export { agreementApi, agreementRequired, consentGate };
