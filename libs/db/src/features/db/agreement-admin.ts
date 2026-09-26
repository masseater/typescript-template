import { ADMIN_PERMISSION, AUDIT_ACTION, type AgreementKind } from "@repo/config";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { agreementVersion } from "./agreement-schema.ts";
import { AgreementVersionTaken } from "./agreement-version-taken.ts";
import { AgreementVersionUnavailable } from "./agreement-version-unavailable.ts";
import { auditWhen } from "./audit.ts";
import { query } from "./database.ts";
import { liveAdmin, requireAdmin } from "./privileged-session.ts";

const canPublishAgreements = Effect.fn("canPublishAgreements")(function* canPublishAgreements(
  sessionId: string,
) {
  return yield* requireAdmin(sessionId, ADMIN_PERMISSION.operator).pipe(
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
    return yield* AgreementVersionUnavailable.make();
  }
  return { ...found, canPublish: yield* canPublishAgreements(sessionId) };
});

const blankToNull = (summary: string | undefined): string | null => {
  const trimmed = summary?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

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
    const [createdDraft] = yield* query((database) =>
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
    if (!createdDraft) {
      return yield* AgreementVersionTaken.make();
    }
    return createdDraft;
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
      return yield* AgreementVersionUnavailable.make();
    }
    return revised;
  },
);

const publishAgreementVersion = Effect.fn("publishAgreementVersion")(
  function* publishAgreementVersion(published: {
    readonly id: string;
    readonly sessionId: string;
  }) {
    const actor = yield* requireAdmin(published.sessionId, ADMIN_PERMISSION.operator);
    const publishedAt = DateTime.toDate(yield* DateTime.now);
    const change = {
      action: AUDIT_ACTION.agreementPublished,
      actorId: actor.user.id,
      targetId: published.id,
    } as const;
    const [, publishedVersions] = yield* query((database) => {
      const publishingAdminIsLive = liveAdmin(database, {
        checkedAt: publishedAt,
        required: ADMIN_PERMISSION.operator,
        sessionId: published.sessionId,
      });
      const unpublishedDraft = and(
        eq(agreementVersion.id, published.id),
        isNull(agreementVersion.publishedAt),
      );
      const targeted = sql`SELECT 1 FROM ${agreementVersion} WHERE ${unpublishedDraft} AND ${publishingAdminIsLive}`;
      const audit = database.run(auditWhen(change, targeted));
      const publication = database
        .update(agreementVersion)
        .set({ publishedAt, publishedBy: actor.user.id })
        .where(and(unpublishedDraft, publishingAdminIsLive))
        .returning({
          id: agreementVersion.id,
          kind: agreementVersion.kind,
          version: agreementVersion.version,
        });
      return database.batch([audit, publication] as const);
    });
    const [version] = publishedVersions;
    if (!version) {
      return yield* AgreementVersionUnavailable.make();
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
