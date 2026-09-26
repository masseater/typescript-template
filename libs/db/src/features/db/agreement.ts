import { agreementPolicies, type AgreementKind, type AgreementPolicy } from "@repo/config";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { Effect } from "effect";

import { AgreementRequired } from "./agreement-required.ts";
import { agreementAcceptance, agreementVersion } from "./agreement-schema.ts";
import { AgreementVersionUnavailable } from "./agreement-version-unavailable.ts";
import { AgreementWithdrawalUnavailable } from "./agreement-withdrawal-unavailable.ts";
import { query } from "./database.ts";

const publishedColumns = {
  id: agreementVersion.id,
  kind: agreementVersion.kind,
  publishedAt: agreementVersion.publishedAt,
  summary: agreementVersion.summary,
  version: agreementVersion.version,
} as const;

type PublishedAgreement = Readonly<{
  id: string;
  kind: AgreementKind;
  publishedAt: Date;
  summary: string | null;
  version: string;
}>;

const firstOfEachKind = (
  publishedVersions: readonly Readonly<
    Omit<PublishedAgreement, "publishedAt"> & { publishedAt: Date | null }
  >[],
): readonly PublishedAgreement[] =>
  publishedVersions.reduce<readonly PublishedAgreement[]>(
    (latestByKind, publishedVersion) =>
      publishedVersion.publishedAt === null ||
      latestByKind.some((agreement) => agreement.kind === publishedVersion.kind)
        ? latestByKind
        : [...latestByKind, { ...publishedVersion, publishedAt: publishedVersion.publishedAt }],
    [],
  );

const latestPublishedAgreements = Effect.fn("latestPublishedAgreements")(
  function* latestPublishedAgreements() {
    const publishedVersions = yield* query((database) =>
      database
        .select(publishedColumns)
        .from(agreementVersion)
        .where(isNotNull(agreementVersion.publishedAt))
        .orderBy(desc(agreementVersion.publishedAt), desc(agreementVersion.id)),
    );
    return firstOfEachKind(publishedVersions);
  },
);

const publishedAgreement = Effect.fn("publishedAgreement")(function* publishedAgreement(
  agreementKind: AgreementKind,
) {
  const [latest] = yield* query((database) =>
    database
      .select({ ...publishedColumns, body: agreementVersion.body })
      .from(agreementVersion)
      .where(and(eq(agreementVersion.kind, agreementKind), isNotNull(agreementVersion.publishedAt)))
      .orderBy(desc(agreementVersion.publishedAt), desc(agreementVersion.id))
      .limit(1),
  );
  if (!latest?.publishedAt) {
    return null;
  }
  return { ...latest, publishedAt: latest.publishedAt };
});

const pendingAgreements = Effect.fn("pendingAgreements")(function* pendingAgreements(
  userId: string,
) {
  const latest = yield* latestPublishedAgreements();
  if (latest.length === 0) {
    return [] as readonly PublishedAgreement[];
  }
  const latestIds = latest.map((agreement) => agreement.id);
  const accepted = yield* query((database) =>
    database
      .select({ versionId: agreementAcceptance.versionId })
      .from(agreementAcceptance)
      .where(
        and(
          eq(agreementAcceptance.userId, userId),
          inArray(agreementAcceptance.versionId, latestIds),
        ),
      ),
  );
  const acceptedIds = new Set(accepted.map((acceptance) => acceptance.versionId));
  return latest.filter((agreement) => !acceptedIds.has(agreement.id));
});

const pendingAgreementKinds = Effect.fn("pendingAgreementKinds")(function* pendingAgreementKinds(
  userId: string,
) {
  const pending = yield* pendingAgreements(userId);
  return pending.map((agreement) => agreement.kind);
});

const requireAgreementsWhere = (
  userId: string,
  applies: (policy: AgreementPolicy) => boolean,
): Effect.Effect<
  void,
  AgreementRequired | Effect.Error<ReturnType<typeof pendingAgreements>>,
  Effect.Services<ReturnType<typeof pendingAgreements>>
> =>
  Effect.gen(function* requireAgreements() {
    const pendingKinds = yield* pendingAgreementKinds(userId);
    const missing = pendingKinds.filter((pendingKind) => applies(agreementPolicies[pendingKind]));
    if (missing.length > 0) {
      return yield* AgreementRequired.make({ kinds: missing });
    }
  });

const requireCurrentAgreements = Effect.fn("requireCurrentAgreements")(
  function* requireCurrentAgreements(userId: string) {
    yield* requireAgreementsWhere(userId, (policy) => policy.blocksUntilReaccepted);
  },
);

const requireSignupAgreements = Effect.fn("requireSignupAgreements")(
  function* requireSignupAgreements(userId: string) {
    yield* requireAgreementsWhere(userId, (policy) => policy.requiredAtSignup);
  },
);

const acceptAgreementVersions = Effect.fn("acceptAgreementVersions")(
  function* acceptAgreementVersions(accepted: {
    readonly acceptedAt: Date;
    readonly userId: string;
    readonly versionIds: readonly string[];
  }) {
    const requested = [...new Set(accepted.versionIds)];
    if (requested.length === 0) {
      return yield* AgreementVersionUnavailable.make();
    }
    const published = yield* query((database) =>
      database
        .select({ id: agreementVersion.id })
        .from(agreementVersion)
        .where(
          and(inArray(agreementVersion.id, requested), isNotNull(agreementVersion.publishedAt)),
        ),
    );
    if (published.length !== requested.length) {
      return yield* AgreementVersionUnavailable.make();
    }
    const acceptances = requested.map((versionId) => ({
      acceptedAt: accepted.acceptedAt,
      userId: accepted.userId,
      versionId,
    }));
    yield* query((database) =>
      database.insert(agreementAcceptance).values(acceptances).onConflictDoNothing(),
    );
  },
);

type AcceptedAgreement = Readonly<{
  acceptedAt: Date;
  kind: AgreementKind;
  version: string;
  versionId: string;
}>;

const acceptedAgreements = Effect.fn("acceptedAgreements")(function* acceptedAgreements(
  userId: string,
) {
  const acceptedVersions: readonly AcceptedAgreement[] = yield* query((database) =>
    database
      .select({
        acceptedAt: agreementAcceptance.acceptedAt,
        kind: agreementVersion.kind,
        version: agreementVersion.version,
        versionId: agreementAcceptance.versionId,
      })
      .from(agreementAcceptance)
      .innerJoin(agreementVersion, eq(agreementAcceptance.versionId, agreementVersion.id))
      .where(eq(agreementAcceptance.userId, userId))
      .orderBy(desc(agreementAcceptance.acceptedAt), agreementVersion.kind),
  );
  return acceptedVersions;
});

const hasAcceptedLatestAgreement = Effect.fn("hasAcceptedLatestAgreement")(
  function* hasAcceptedLatestAgreement(userId: string, agreementKind: AgreementKind) {
    const pending = yield* pendingAgreements(userId);
    return !pending.some((agreement) => agreement.kind === agreementKind);
  },
);

const withdrawAgreementKind = Effect.fn("withdrawAgreementKind")(
  function* withdrawAgreementKind(withdrawn: {
    readonly kind: AgreementKind;
    readonly userId: string;
  }) {
    if (!agreementPolicies[withdrawn.kind].withdrawable) {
      return yield* AgreementWithdrawalUnavailable.make();
    }
    const accepted = yield* acceptedAgreements(withdrawn.userId);
    const versionIds = accepted
      .filter((agreement) => agreement.kind === withdrawn.kind)
      .map((agreement) => agreement.versionId);
    if (versionIds.length === 0) {
      return yield* AgreementWithdrawalUnavailable.make();
    }
    yield* query((database) =>
      database
        .delete(agreementAcceptance)
        .where(
          and(
            eq(agreementAcceptance.userId, withdrawn.userId),
            inArray(agreementAcceptance.versionId, versionIds),
          ),
        ),
    );
  },
);

export {
  AgreementRequired,
  AgreementVersionUnavailable,
  AgreementWithdrawalUnavailable,
  acceptAgreementVersions,
  acceptedAgreements,
  hasAcceptedLatestAgreement,
  pendingAgreementKinds,
  pendingAgreements,
  publishedAgreement,
  requireCurrentAgreements,
  requireSignupAgreements,
  withdrawAgreementKind,
};
export type { AcceptedAgreement, PublishedAgreement };
