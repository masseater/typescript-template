import { agreementPolicies, type AgreementKind, type AgreementPolicy } from "@repo/config";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { Effect } from "effect";

import { AgreementRequired } from "./agreement-required.ts";
import { agreementAcceptance, agreementVersion } from "./agreement-schema.ts";
import { AgreementVersionUnavailable } from "./agreement-version-unavailable.ts";
import { query } from "./database.ts";

interface PublishedAgreement {
  readonly id: string;
  readonly kind: AgreementKind;
  readonly publishedAt: Date;
  readonly summary: string | null;
  readonly version: string;
}

interface AcceptedAgreement {
  readonly acceptedAt: Date;
  readonly kind: AgreementKind;
  readonly version: string;
  readonly versionId: string;
}

const publishedColumns = {
  id: agreementVersion.id,
  kind: agreementVersion.kind,
  publishedAt: agreementVersion.publishedAt,
  summary: agreementVersion.summary,
  version: agreementVersion.version,
} as const;

const latestPublishedAgreements = Effect.fn("latestPublishedAgreements")(
  function* latestPublishedAgreements() {
    const rows = yield* query((database) =>
      database
        .select(publishedColumns)
        .from(agreementVersion)
        .where(isNotNull(agreementVersion.publishedAt))
        .orderBy(desc(agreementVersion.publishedAt), desc(agreementVersion.id)),
    );
    const latest = new Map<AgreementKind, PublishedAgreement>();
    for (const row of rows) {
      if (row.publishedAt !== null && !latest.has(row.kind)) {
        latest.set(row.kind, { ...row, publishedAt: row.publishedAt });
      }
    }
    return [...latest.values()];
  },
);

const publishedAgreement = Effect.fn("publishedAgreement")(function* publishedAgreement(
  kind: AgreementKind,
) {
  const [latest] = yield* query((database) =>
    database
      .select({ ...publishedColumns, body: agreementVersion.body })
      .from(agreementVersion)
      .where(and(eq(agreementVersion.kind, kind), isNotNull(agreementVersion.publishedAt)))
      .orderBy(desc(agreementVersion.publishedAt), desc(agreementVersion.id))
      .limit(1),
  );
  if (latest === undefined || latest.publishedAt === null) {
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
  const accepted = yield* query((database) =>
    database
      .select({ versionId: agreementAcceptance.versionId })
      .from(agreementAcceptance)
      .where(
        and(
          eq(agreementAcceptance.userId, userId),
          inArray(
            agreementAcceptance.versionId,
            latest.map((agreement) => agreement.id),
          ),
        ),
      ),
  );
  const acceptedIds = new Set(accepted.map((row) => row.versionId));
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
    const kinds = yield* pendingAgreementKinds(userId);
    const missing = kinds.filter((kind) => applies(agreementPolicies[kind]));
    if (missing.length > 0) {
      return yield* new AgreementRequired({ kinds: missing });
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
      return yield* new AgreementVersionUnavailable();
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
      return yield* new AgreementVersionUnavailable();
    }
    yield* query((database) =>
      database
        .insert(agreementAcceptance)
        .values(
          requested.map((versionId) => ({
            acceptedAt: accepted.acceptedAt,
            userId: accepted.userId,
            versionId,
          })),
        )
        .onConflictDoNothing(),
    );
  },
);

const acceptedAgreements = Effect.fn("acceptedAgreements")(function* acceptedAgreements(
  userId: string,
) {
  const rows: readonly AcceptedAgreement[] = yield* query((database) =>
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
  return rows;
});

export {
  AgreementRequired,
  AgreementVersionUnavailable,
  acceptAgreementVersions,
  acceptedAgreements,
  pendingAgreementKinds,
  pendingAgreements,
  publishedAgreement,
  requireCurrentAgreements,
  requireSignupAgreements,
};
export type { AcceptedAgreement, PublishedAgreement };
