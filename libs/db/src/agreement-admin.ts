import { ADMIN_PERMISSION, AUDIT_ACTION, type AgreementKind } from "@repo/config";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { agreementVersion } from "./agreement-schema.ts";
import { AgreementVersionTaken } from "./agreement-version-taken.ts";
import { AgreementVersionUnavailable } from "./agreement-version-unavailable.ts";
import { auditWhen } from "./audit.ts";
import { query, type DrizzleDatabase } from "./database.ts";
import { liveAdmin, requireAdmin } from "./privileged-session.ts";

const requirePublishingAdmin = (sessionId: string): ReturnType<typeof requireAdmin> =>
  requireAdmin(sessionId, ADMIN_PERMISSION.operator);

const livePublishingAdmin = (
  database: DrizzleDatabase,
  sessionId: string,
  checkedAt: Date,
): SQL => liveAdmin(database, sessionId, checkedAt, ADMIN_PERMISSION.operator);

const canPublishAgreements = Effect.fn("canPublishAgreements")(function* canPublishAgreements(
  sessionId: string,
) {
  return yield* requirePublishingAdmin(sessionId).pipe(
    Effect.as(true),
    Effect.catchTags({
      AdminStrongSessionRequired: () => Effect.succeed(false),
      PermissionRequired: () => Effect.succeed(false),
    }),
  );
});

const listedColumns = {
  createdAt: agreementVersion.createdAt,
  id: agreementVersion.id,
  kind: agreementVersion.kind,
  publishedAt: agreementVersion.publishedAt,
  summary: agreementVersion.summary,
  version: agreementVersion.version,
} as const;

const blankToNull = (summary: string | undefined): string | null => {
  const trimmed = summary?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

const listAgreementVersions = Effect.fn("listAgreementVersions")(function* listAgreementVersions(
  sessionId: string,
) {
  yield* requireAdmin(sessionId);
  const versions = yield* query((database) =>
    database
      .select(listedColumns)
      .from(agreementVersion)
      .orderBy(agreementVersion.kind, desc(agreementVersion.createdAt), agreementVersion.id),
  );
  return { canPublish: yield* canPublishAgreements(sessionId), versions };
});

const readAgreementVersion = Effect.fn("readAgreementVersion")(function* readAgreementVersion(
  sessionId: string,
  version: string,
) {
  yield* requireAdmin(sessionId);
  const [found] = yield* query((database) =>
    database
      .select({ ...listedColumns, body: agreementVersion.body })
      .from(agreementVersion)
      .where(eq(agreementVersion.version, version))
      .limit(1),
  );
  if (!found) {
    return yield* new AgreementVersionUnavailable();
  }
  return { ...found, canPublish: yield* canPublishAgreements(sessionId) };
});

const createAgreementDraft = Effect.fn("createAgreementDraft")(
  function* createAgreementDraft(draft: {
    readonly body: string;
    readonly kind: AgreementKind;
    readonly sessionId: string;
    readonly summary: string | undefined;
    readonly version: string;
  }) {
    const actor = yield* requireAdmin(draft.sessionId);
    const createdAt = DateTime.toDate(yield* DateTime.now);
    const [created] = yield* query((database) =>
      database
        .insert(agreementVersion)
        .values({
          body: draft.body,
          createdAt,
          createdBy: actor.user.id,
          id: crypto.randomUUID(),
          kind: draft.kind,
          summary: blankToNull(draft.summary),
          version: draft.version,
        })
        .onConflictDoNothing({ target: agreementVersion.version })
        .returning({ id: agreementVersion.id, version: agreementVersion.version }),
    );
    if (!created) {
      return yield* new AgreementVersionTaken();
    }
    return created;
  },
);

const reviseAgreementDraft = Effect.fn("reviseAgreementDraft")(
  function* reviseAgreementDraft(revision: {
    readonly body: string;
    readonly id: string;
    readonly sessionId: string;
    readonly summary: string | undefined;
  }) {
    yield* requireAdmin(revision.sessionId);
    const [revised] = yield* query((database) =>
      database
        .update(agreementVersion)
        .set({ body: revision.body, summary: blankToNull(revision.summary) })
        .where(and(eq(agreementVersion.id, revision.id), isNull(agreementVersion.publishedAt)))
        .returning({ id: agreementVersion.id, version: agreementVersion.version }),
    );
    if (!revised) {
      return yield* new AgreementVersionUnavailable();
    }
    return revised;
  },
);

const publishAgreementVersion = Effect.fn("publishAgreementVersion")(
  function* publishAgreementVersion(published: {
    readonly id: string;
    readonly sessionId: string;
  }) {
    const actor = yield* requirePublishingAdmin(published.sessionId);
    const publishedAt = DateTime.toDate(yield* DateTime.now);
    const change = {
      action: AUDIT_ACTION.agreementPublished,
      actorId: actor.user.id,
      targetId: published.id,
    } as const;
    const [, publishedVersions] = yield* query((database) => {
      const unpublishedDraft = and(
        eq(agreementVersion.id, published.id),
        isNull(agreementVersion.publishedAt),
      );
      const targeted = sql`SELECT 1 FROM ${agreementVersion} WHERE ${unpublishedDraft} AND ${livePublishingAdmin(database, published.sessionId, publishedAt)}`;
      const audit = database.run(auditWhen(change, targeted));
      const publication = database
        .update(agreementVersion)
        .set({ publishedAt, publishedBy: actor.user.id })
        .where(and(unpublishedDraft, livePublishingAdmin(database, published.sessionId, publishedAt)))
        .returning({
          id: agreementVersion.id,
          kind: agreementVersion.kind,
          version: agreementVersion.version,
        });
      return database.batch([audit, publication] as const);
    });
    const [version] = publishedVersions;
    if (!version) {
      return yield* new AgreementVersionUnavailable();
    }
    return version;
  },
);

export {
  AgreementVersionTaken,
  AgreementVersionUnavailable,
  createAgreementDraft,
  listAgreementVersions,
  publishAgreementVersion,
  readAgreementVersion,
  reviseAgreementDraft,
};
