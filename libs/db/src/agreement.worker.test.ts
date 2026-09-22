import { assert, it } from "@effect/vitest";
import { ADMIN_PERMISSION, AGREEMENT_KIND, APPLICATION, AUDIT_ACTION, ROLE } from "@repo/config";
import { eq } from "drizzle-orm";
import { DateTime, Effect } from "effect";
import { TestClock } from "effect/testing";

import {
  createAgreementDraft,
  listAgreementVersions,
  publishAgreementVersion,
} from "./agreement-admin.ts";
import { agreementAcceptance, agreementVersion } from "./agreement-schema.ts";
import {
  acceptAgreementVersions,
  acceptedAgreements,
  pendingAgreementKinds,
  pendingAgreements,
  publishedAgreement,
  requireCurrentAgreements,
  requireSignupAgreements,
  withdrawAgreementKind,
} from "./agreement.ts";
import { query } from "./database.ts";
import { addSession, addUser } from "./records-fixture.ts";
import { auditEvent } from "./schema.ts";
import { TestDatabase } from "./testing.ts";

const acceptedAt = DateTime.toDate(DateTime.makeUnsafe("2026-02-01T00:00:00.000Z"));
const seededAgreementPublishedAt = 1_789_862_400_000;
const afterSeededAgreements = Effect.fn("afterSeededAgreements")(function* afterSeededAgreements() {
  yield* TestClock.setTime(seededAgreementPublishedAt + 86_400_000);
});

const clearVersions = query((database) => database.delete(agreementVersion));

const adminSession = Effect.fn("adminSession")(function* adminSession(userId: string) {
  yield* addUser({ role: ROLE.administrator, userId });
  return yield* addSession({ audience: APPLICATION.admin, userId });
});

const publishDraft = Effect.fn("publishDraft")(function* publishDraft(draft: {
  readonly kind: typeof AGREEMENT_KIND.terms | typeof AGREEMENT_KIND.privacy;
  readonly sessionId: string;
  readonly version: string;
}) {
  const created = yield* createAgreementDraft({
    body: `${draft.version} body`,
    kind: draft.kind,
    sessionId: draft.sessionId,
    summary: undefined,
    version: draft.version,
  });
  return yield* publishAgreementVersion({ id: created.id, sessionId: draft.sessionId });
});

const acceptAllPending = Effect.fn("acceptAllPending")(function* acceptAllPending(userId: string) {
  const pending = yield* pendingAgreements(userId);
  yield* acceptAgreementVersions({
    acceptedAt,
    userId,
    versionIds: pending.map((agreement) => agreement.id),
  });
});

it.effect(
  "seeds a published terms and privacy version so a fresh database can collect consent",
  () =>
    Effect.gen(function* program() {
      yield* afterSeededAgreements();
      yield* addUser({ userId: "member" });
      assert.deepStrictEqual((yield* pendingAgreementKinds("member")).toSorted(), [
        AGREEMENT_KIND.interview_history,
        AGREEMENT_KIND.privacy,
        AGREEMENT_KIND.terms,
      ]);
      assert.strictEqual((yield* publishedAgreement(AGREEMENT_KIND.terms))?.version, "terms-1");
    }).pipe(Effect.provide(TestDatabase)),
);

it.effect("has nothing pending when no version is published", () =>
  Effect.gen(function* program() {
      yield* afterSeededAgreements();
    yield* clearVersions;
    yield* addUser({ userId: "member" });
    assert.deepStrictEqual(yield* pendingAgreementKinds("member"), []);
    yield* requireCurrentAgreements("member");
    yield* requireSignupAgreements("member");
    assert.isNull(yield* publishedAgreement(AGREEMENT_KIND.terms));
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("records who accepted which version and when, then clears the pending kinds", () =>
  Effect.gen(function* program() {
      yield* afterSeededAgreements();
    yield* addUser({ userId: "member" });
    const failure = yield* Effect.flip(requireSignupAgreements("member"));
    assert.strictEqual(failure._tag, "AgreementRequired");
    if (failure._tag !== "AgreementRequired") {
      return;
    }
    assert.deepStrictEqual(failure.kinds.toSorted(), [
      AGREEMENT_KIND.privacy,
      AGREEMENT_KIND.terms,
    ]);
    yield* acceptAllPending("member");
    assert.deepStrictEqual(yield* pendingAgreementKinds("member"), []);
    yield* requireCurrentAgreements("member");
    yield* requireSignupAgreements("member");
    const history = yield* acceptedAgreements("member");
    assert.deepStrictEqual(
      history.map(({ acceptedAt: at, kind, version }) => ({ at: at.getTime(), kind, version })),
      [
        {
          at: acceptedAt.getTime(),
          kind: AGREEMENT_KIND.interview_history,
          version: "interview-history-1",
        },
        { at: acceptedAt.getTime(), kind: AGREEMENT_KIND.privacy, version: "privacy-1" },
        { at: acceptedAt.getTime(), kind: AGREEMENT_KIND.terms, version: "terms-1" },
      ],
    );
    const rows = yield* query((database) =>
      database.select().from(agreementAcceptance).where(eq(agreementAcceptance.userId, "member")),
    );
    assert.strictEqual(rows.length, 3);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("refuses to record acceptance of a draft or unknown version", () =>
  Effect.gen(function* program() {
      yield* afterSeededAgreements();
    yield* addUser({ userId: "member" });
    const sessionId = yield* adminSession("admin");
    const draft = yield* createAgreementDraft({
      body: "draft",
      kind: AGREEMENT_KIND.terms,
      sessionId,
      summary: undefined,
      version: "terms-2",
    });
    for (const versionIds of [[draft.id], ["missing"], []]) {
      const failure = yield* Effect.flip(
        acceptAgreementVersions({ acceptedAt, userId: "member", versionIds }),
      );
      assert.strictEqual(failure._tag, "AgreementVersionUnavailable");
    }
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("asks again only for the kind whose accepted version was superseded", () =>
  Effect.gen(function* program() {
      yield* afterSeededAgreements();
    yield* addUser({ userId: "member" });
    yield* acceptAllPending("member");
    const sessionId = yield* adminSession("admin");
    yield* publishDraft({ kind: AGREEMENT_KIND.privacy, sessionId, version: "privacy-2" });
    assert.deepStrictEqual(yield* pendingAgreementKinds("member"), [AGREEMENT_KIND.privacy]);
    yield* requireCurrentAgreements("member");
    yield* publishDraft({ kind: AGREEMENT_KIND.terms, sessionId, version: "terms-2" });
    assert.deepStrictEqual((yield* pendingAgreementKinds("member")).toSorted(), [
      AGREEMENT_KIND.privacy,
      AGREEMENT_KIND.terms,
    ]);
    const blocked = yield* Effect.flip(requireCurrentAgreements("member"));
    assert.strictEqual(blocked._tag, "AgreementRequired");
    if (blocked._tag !== "AgreementRequired") {
      return;
    }
    assert.deepStrictEqual(blocked.kinds, [AGREEMENT_KIND.terms]);
    yield* acceptAllPending("member");
    yield* requireCurrentAgreements("member");
    assert.strictEqual((yield* acceptedAgreements("member")).length, 5);
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("reports canPublish for a strong admin and refuses a member", () =>
  Effect.gen(function* program() {
      yield* afterSeededAgreements();
    const sessionId = yield* adminSession("publisher");
    assert.strictEqual((yield* listAgreementVersions(sessionId)).canPublish, true);
    yield* addUser({ userId: "member" });
    const memberSession = yield* addSession({ audience: APPLICATION.admin, userId: "member" });
    const draft = yield* createAgreementDraft({
      body: "draft",
      kind: AGREEMENT_KIND.terms,
      sessionId,
      summary: undefined,
      version: "terms-9",
    });
    const failure = yield* Effect.flip(
      publishAgreementVersion({ id: draft.id, sessionId: memberSession }),
    );
    assert.strictEqual(failure._tag, "AdminStrongSessionRequired");
    assert.strictEqual((yield* publishedAgreement(AGREEMENT_KIND.terms))?.version, "terms-1");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("publishes once, records an audit event and refuses a second publication", () =>
  Effect.gen(function* program() {
      yield* afterSeededAgreements();
    const sessionId = yield* adminSession("admin");
    const created = yield* createAgreementDraft({
      body: "new terms",
      kind: AGREEMENT_KIND.terms,
      sessionId,
      summary: "  ",
      version: "terms-2",
    });
    const published = yield* publishAgreementVersion({ id: created.id, sessionId });
    assert.deepStrictEqual(published, {
      id: created.id,
      kind: AGREEMENT_KIND.terms,
      version: "terms-2",
    });
    const audits = yield* query((database) =>
      database.select().from(auditEvent).where(eq(auditEvent.targetId, created.id)),
    );
    assert.deepStrictEqual(
      audits.map(({ action, actorId }) => ({ action, actorId })),
      [{ action: AUDIT_ACTION.agreementPublished, actorId: "admin" }],
    );
    const [stored] = yield* query((database) =>
      database.select().from(agreementVersion).where(eq(agreementVersion.id, created.id)),
    );
    assert.strictEqual(stored?.publishedBy, "admin");
    assert.strictEqual(stored?.createdBy, "admin");
    assert.isNull(stored?.summary);
    const again = yield* Effect.flip(publishAgreementVersion({ id: created.id, sessionId }));
    assert.strictEqual(again._tag, "AgreementVersionUnavailable");
    assert.strictEqual((yield* publishedAgreement(AGREEMENT_KIND.terms))?.version, "terms-2");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("rejects a duplicate version label", () =>
  Effect.gen(function* program() {
      yield* afterSeededAgreements();
    const sessionId = yield* adminSession("admin");
    const failure = yield* Effect.flip(
      createAgreementDraft({
        body: "duplicate",
        kind: AGREEMENT_KIND.terms,
        sessionId,
        summary: undefined,
        version: "terms-1",
      }),
    );
    assert.strictEqual(failure._tag, "AgreementVersionTaken");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("lets a view-only admin draft an agreement but not publish it", () =>
  Effect.gen(function* program() {
      yield* afterSeededAgreements();
    yield* addUser({
      permission: ADMIN_PERMISSION.viewer,
      role: ROLE.administrator,
      userId: "viewer",
    });
    const sessionId = yield* addSession({ audience: APPLICATION.admin, userId: "viewer" });
    assert.strictEqual((yield* listAgreementVersions(sessionId)).canPublish, false);
    const draft = yield* createAgreementDraft({
      body: "draft",
      kind: AGREEMENT_KIND.terms,
      sessionId,
      summary: undefined,
      version: "terms-9",
    });
    const failure = yield* Effect.flip(publishAgreementVersion({ id: draft.id, sessionId }));
    assert.strictEqual(failure._tag, "PermissionRequired");
    assert.strictEqual((yield* publishedAgreement(AGREEMENT_KIND.terms))?.version, "terms-1");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("withdraws only agreement kinds marked withdrawable", () =>
  Effect.gen(function* program() {
      yield* afterSeededAgreements();
    yield* addUser({ userId: "member" });
    yield* acceptAllPending("member");
    yield* withdrawAgreementKind({ kind: AGREEMENT_KIND.interview_history, userId: "member" });
    assert.isFalse(
      (yield* acceptedAgreements("member")).some(
        (agreement) => agreement.kind === AGREEMENT_KIND.interview_history,
      ),
    );
    const termsWithdrawal = yield* Effect.flip(
      withdrawAgreementKind({ kind: AGREEMENT_KIND.terms, userId: "member" }),
    );
    assert.strictEqual(termsWithdrawal._tag, "AgreementWithdrawalUnavailable");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("refuses drafting and publishing to members and to weak admin sessions", () =>
  Effect.gen(function* program() {
      yield* afterSeededAgreements();
    yield* addUser({ userId: "member" });
    const memberSession = yield* addSession({ audience: APPLICATION.admin, userId: "member" });
    yield* addUser({ role: ROLE.administrator, userId: "weak" });
    const weakSession = yield* addSession({
      audience: APPLICATION.admin,
      strong: false,
      userId: "weak",
    });
    const adminId = yield* adminSession("admin");
    const draft = yield* createAgreementDraft({
      body: "new terms",
      kind: AGREEMENT_KIND.terms,
      sessionId: adminId,
      summary: undefined,
      version: "terms-2",
    });
    for (const sessionId of [memberSession, weakSession]) {
      const drafting = yield* Effect.flip(
        createAgreementDraft({
          body: "x",
          kind: AGREEMENT_KIND.privacy,
          sessionId,
          summary: undefined,
          version: `privacy-${sessionId}`,
        }),
      );
      assert.strictEqual(drafting._tag, "AdminStrongSessionRequired");
      const publishing = yield* Effect.flip(publishAgreementVersion({ id: draft.id, sessionId }));
      assert.strictEqual(publishing._tag, "AdminStrongSessionRequired");
    }
    const audits = yield* query((database) =>
      database.select().from(auditEvent).where(eq(auditEvent.targetId, draft.id)),
    );
    assert.deepStrictEqual(audits, []);
    assert.strictEqual((yield* publishedAgreement(AGREEMENT_KIND.terms))?.version, "terms-1");
  }).pipe(Effect.provide(TestDatabase)),
);
