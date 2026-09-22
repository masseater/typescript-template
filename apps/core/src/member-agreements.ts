import {
  SessionIdentity,
  type AgreementAcceptance,
  type AgreementsView,
  type PublishedAgreementView,
} from "@repo/core-api";
import {
  AgreementRequired,
  AgreementVersionUnavailable,
  AgreementWithdrawalUnavailable,
  acceptAgreementVersions,
  acceptedAgreements,
  pendingAgreements,
  publishedAgreement as readPublishedAgreement,
  requireCurrentAgreements as requireAgreements,
  withdrawAgreementKind,
  type Database,
  type DatabaseFailure,
} from "@repo/db";
import { DateTime, Effect } from "effect";

import type { AgreementKind } from "@repo/config";

const dieDatabase = {
  DatabaseFailure: (failure: DatabaseFailure) => Effect.die(failure),
} as const;

const agreementsOf = (userId: string): Effect.Effect<typeof AgreementsView.Type, never, Database> =>
  Effect.gen(function* agreementsOfProgram() {
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
  }).pipe(Effect.catchTags(dieDatabase));

const listAgreements = (): Effect.Effect<
  typeof AgreementsView.Type,
  never,
  SessionIdentity | Database
> =>
  Effect.gen(function* listAgreementsProgram() {
    const identity = yield* SessionIdentity;
    return yield* agreementsOf(identity.user.id);
  });

const acceptAgreements = (
  acceptance: typeof AgreementAcceptance.Type,
): Effect.Effect<
  typeof AgreementsView.Type,
  AgreementVersionUnavailable,
  SessionIdentity | Database
> =>
  Effect.gen(function* acceptAgreementsProgram() {
    const identity = yield* SessionIdentity;
    yield* acceptAgreementVersions({
      acceptedAt: DateTime.toDate(yield* DateTime.now),
      userId: identity.user.id,
      versionIds: acceptance.versionIds,
    }).pipe(Effect.catchTags(dieDatabase));
    return yield* agreementsOf(identity.user.id);
  });

const publishedAgreement = (
  kind: AgreementKind,
): Effect.Effect<typeof PublishedAgreementView.Type, AgreementVersionUnavailable, Database> =>
  Effect.gen(function* publishedAgreementProgram() {
    const found = yield* readPublishedAgreement(kind).pipe(Effect.catchTags(dieDatabase));
    if (found === null) {
      return yield* new AgreementVersionUnavailable();
    }
    return { ...found, publishedAt: found.publishedAt.getTime() };
  });

const withdrawAgreement = (
  kind: AgreementKind,
): Effect.Effect<
  typeof AgreementsView.Type,
  AgreementWithdrawalUnavailable,
  SessionIdentity | Database
> =>
  Effect.gen(function* withdrawAgreementProgram() {
    const identity = yield* SessionIdentity;
    yield* withdrawAgreementKind({ kind, userId: identity.user.id }).pipe(
      Effect.catchTags(dieDatabase),
    );
    return yield* agreementsOf(identity.user.id);
  });

const requireCurrentAgreements = (): Effect.Effect<
  void,
  AgreementRequired,
  SessionIdentity | Database
> =>
  Effect.gen(function* requireCurrentAgreementsProgram() {
    const identity = yield* SessionIdentity;
    yield* requireAgreements(identity.user.id).pipe(Effect.catchTags(dieDatabase));
  });

export {
  acceptAgreements,
  listAgreements,
  publishedAgreement,
  requireCurrentAgreements,
  withdrawAgreement,
};
