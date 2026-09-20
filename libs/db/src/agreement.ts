import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { requireAdmin, requireOperatingAdmin } from "./admin-session.ts";
import { agreementAcceptance, agreementKinds, agreementVersion } from "./agreement-schema.ts";
import { query } from "./database.ts";
import { ADMIN_PERMISSION } from "./identity-schema.ts";
import { advanceOnboarding, stepOf } from "./member-social.ts";

import type { AgreementKind } from "./agreement-schema.ts";

class AgreementRequired extends Schema.TaggedError<AgreementRequired>()("AgreementRequired", {
  kind: Schema.Literals(["privacy", "terms"]),
}) {}

class AgreementMissing extends Schema.TaggedError<AgreementMissing>()("AgreementMissing", {
  kind: Schema.Literals(agreementKinds),
}) {}

class AgreementVersionUnavailable extends Schema.TaggedError<AgreementVersionUnavailable>()(
  "AgreementVersionUnavailable",
  {},
) {}

const latestPublished = Effect.fn("latestPublished")(function* latestPublished(kind: AgreementKind) {
  const [version] = yield* query((database) =>
    database
      .select()
      .from(agreementVersion)
      .where(and(eq(agreementVersion.kind, kind), isNotNull(agreementVersion.publishedAt)))
      .orderBy(desc(agreementVersion.publishedAt), desc(agreementVersion.id))
      .limit(1),
  );
  return version ?? null;
});

const hasAcceptance = Effect.fn("hasAcceptance")(function* hasAcceptance(
  userId: string,
  versionId: string,
) {
  const [acceptance] = yield* query((database) =>
    database
      .select({ userId: agreementAcceptance.userId })
      .from(agreementAcceptance)
      .where(
        and(eq(agreementAcceptance.userId, userId), eq(agreementAcceptance.versionId, versionId)),
      )
      .limit(1),
  );
  return acceptance !== undefined;
});

const consentState = Effect.fn("consentState")(function* consentState(userId: string) {
  const step = yield* stepOf(userId);
  const terms = yield* latestPublished("terms");
  const privacy = yield* latestPublished("privacy");
  return {
    privacyAccepted: privacy === null || (yield* hasAcceptance(userId, privacy.id)),
    privacySummary: privacy?.summary ?? null,
    privacyVersion: privacy?.version ?? null,
    step,
    termsAccepted: terms === null || (yield* hasAcceptance(userId, terms.id)),
    termsSummary: terms?.summary ?? null,
    termsVersion: terms?.version ?? null,
  };
});

const requireConsent = Effect.fn("requireConsent")(function* requireConsent(userId: string) {
  const state = yield* consentState(userId);
  if (!state.termsAccepted) {
    return yield* new AgreementRequired({ kind: "terms" });
  }
  if (state.step !== "done" && !state.privacyAccepted) {
    return yield* new AgreementRequired({ kind: "privacy" });
  }
  return state;
});

const acceptLatest = Effect.fn("acceptLatest")(function* acceptLatest(accepted: {
  readonly acceptedAt: Date;
  readonly kind: AgreementKind;
  readonly userId: string;
}) {
  const version = yield* latestPublished(accepted.kind);
  if (version === null) {
    return yield* new AgreementMissing({ kind: accepted.kind });
  }
  yield* query((database) =>
    database
      .insert(agreementAcceptance)
      .values({ acceptedAt: accepted.acceptedAt, userId: accepted.userId, versionId: version.id })
      .onConflictDoNothing(),
  );
  return version;
});

const acceptRegistration = Effect.fn("acceptRegistration")(function* acceptRegistration(
  userId: string,
  acceptedAt: Date,
) {
  yield* acceptLatest({ acceptedAt, kind: "terms", userId });
  yield* acceptLatest({ acceptedAt, kind: "privacy", userId });
  if ((yield* stepOf(userId)) === "agreement") {
    yield* advanceOnboarding(userId, "choose");
  }
  return yield* consentState(userId);
});

const blankSummary = (summary: string | undefined): string | null => {
  const trimmed = summary?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

const canPublish = (permission: string | null): boolean =>
  permission === ADMIN_PERMISSION.operate || permission === ADMIN_PERMISSION.grant;

const listAgreements = Effect.fn("listAgreements")(function* listAgreements(sessionId: string) {
  const actor = yield* requireAdmin(sessionId);
  const versions = yield* query((database) =>
    database
      .select({
        createdAt: agreementVersion.createdAt,
        id: agreementVersion.id,
        kind: agreementVersion.kind,
        publishedAt: agreementVersion.publishedAt,
        summary: agreementVersion.summary,
        version: agreementVersion.version,
      })
      .from(agreementVersion)
      .orderBy(desc(agreementVersion.createdAt), agreementVersion.id),
  );
  return {
    canPublish: canPublish(actor.user.adminPermission),
    versions: versions.map((version) => ({
      ...version,
      createdAt: version.createdAt.getTime(),
      publishedAt: version.publishedAt?.getTime() ?? null,
    })),
  };
});

const readAgreement = Effect.fn("readAgreement")(function* readAgreement(
  sessionId: string,
  version: string,
) {
  const actor = yield* requireAdmin(sessionId);
  const [found] = yield* query((database) =>
    database
      .select()
      .from(agreementVersion)
      .where(eq(agreementVersion.version, version))
      .limit(1),
  );
  if (!found) {
    return yield* new AgreementVersionUnavailable();
  }
  return {
    body: found.body,
    canPublish: canPublish(actor.user.adminPermission),
    id: found.id,
    kind: found.kind,
    publishedAt: found.publishedAt?.getTime() ?? null,
    summary: found.summary,
    version: found.version,
  };
});

const createAgreementDraft = Effect.fn("createAgreementDraft")(function* createAgreementDraft(draft: {
  readonly body: string;
  readonly kind: AgreementKind;
  readonly sessionId: string;
  readonly summary: string | undefined;
  readonly version: string;
}) {
  yield* requireOperatingAdmin(draft.sessionId);
  const createdAt = new Date();
  const [created] = yield* query((database) =>
    database
      .insert(agreementVersion)
      .values({
        body: draft.body,
        createdAt,
        id: crypto.randomUUID(),
        kind: draft.kind,
        summary: blankSummary(draft.summary),
        version: draft.version,
      })
      .returning({ id: agreementVersion.id, version: agreementVersion.version }),
  );
  if (!created) {
    return yield* new AgreementVersionUnavailable();
  }
  return created;
});

const reviseAgreementDraft = Effect.fn("reviseAgreementDraft")(function* reviseAgreementDraft(revision: {
  readonly body: string;
  readonly id: string;
  readonly sessionId: string;
  readonly summary: string | undefined;
}) {
  yield* requireOperatingAdmin(revision.sessionId);
  const [revised] = yield* query((database) =>
    database
      .update(agreementVersion)
      .set({ body: revision.body, summary: blankSummary(revision.summary) })
      .where(and(eq(agreementVersion.id, revision.id), isNull(agreementVersion.publishedAt)))
      .returning({ id: agreementVersion.id }),
  );
  if (!revised) {
    return yield* new AgreementVersionUnavailable();
  }
  return revised;
});

const publishAgreement = Effect.fn("publishAgreement")(function* publishAgreement(published: {
  readonly id: string;
  readonly publishedAt: Date;
  readonly sessionId: string;
}) {
  yield* requireOperatingAdmin(published.sessionId);
  const [version] = yield* query((database) =>
    database
      .update(agreementVersion)
      .set({ publishedAt: published.publishedAt })
      .where(and(eq(agreementVersion.id, published.id), isNull(agreementVersion.publishedAt)))
      .returning({
        id: agreementVersion.id,
        kind: agreementVersion.kind,
        version: agreementVersion.version,
      }),
  );
  if (!version) {
    return yield* new AgreementVersionUnavailable();
  }
  return version;
});

const publishedDocument = Effect.fn("publishedDocument")(function* publishedDocument(
  kind: "privacy" | "terms",
) {
  const version = yield* latestPublished(kind);
  if (version === null) {
    return yield* new AgreementMissing({ kind });
  }
  return {
    body: version.body,
    kind: version.kind,
    summary: version.summary,
    version: version.version,
  };
});

export {
  AgreementMissing,
  AgreementRequired,
  AgreementVersionUnavailable,
  acceptLatest,
  acceptRegistration,
  consentState,
  createAgreementDraft,
  listAgreements,
  publishAgreement,
  publishedDocument,
  readAgreement,
  requireConsent,
  reviseAgreementDraft,
};
export { OperatingAdminRequired } from "./operating-admin-required.ts";
