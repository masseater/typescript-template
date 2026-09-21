import { assert, it } from "@effect/vitest";
import { APPLICATION, INQUIRY_STATUS, ROLE } from "@repo/config";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { query } from "./database.ts";
import { staffInquiryCounts } from "./inquiry-staff.ts";
import {
  closeInquiry,
  countPendingInquiries,
  createMemberInquiry,
  getMemberInquiry,
  listMemberInquiries,
  replyAsAdmin,
} from "./inquiry.ts";
import { addSession, addUser } from "./records-fixture.ts";
import { auditEvent } from "./schema.ts";
import { TestDatabase } from "./testing.ts";

function failureTag<Value, Failure extends { readonly _tag: string }, Requirements>(
  effect: Effect.Effect<Value, Failure, Requirements>,
): Effect.Effect<string, Value, Requirements> {
  return effect.pipe(
    Effect.flip,
    Effect.map((failure) => failure._tag),
  );
}

it.effect("lists only the member's own inquiries", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "owner" });
    yield* addUser({ userId: "other" });
    yield* createMemberInquiry("owner", { body: "本文", subject: "件名" });
    yield* createMemberInquiry("other", { body: "他人", subject: "他人の件名" });
    const listed = yield* listMemberInquiries("owner");
    assert.strictEqual(listed.length, 1);
    assert.strictEqual(listed[0]?.subject, "件名");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("rejects another member from reading an inquiry", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "owner" });
    yield* addUser({ userId: "intruder" });
    const created = yield* createMemberInquiry("owner", { body: "本文", subject: "件名" });
    assert.strictEqual(
      yield* failureTag(getMemberInquiry("intruder", created.id)),
      "InquiryNotFound",
    );
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("marks an inquiry answered and writes an audit event when an admin replies", () =>
  Effect.gen(function* program() {
    yield* addUser({ role: ROLE.administrator, userId: "admin" });
    yield* addUser({ userId: "member" });
    const sessionId = yield* addSession({ audience: APPLICATION.admin, userId: "admin" });
    const created = yield* createMemberInquiry("member", { body: "本文", subject: "件名" });
    const replied = yield* replyAsAdmin(sessionId, created.id, "返信です");
    assert.strictEqual(replied.status, INQUIRY_STATUS.answered);
    const audits = yield* query((database) =>
      database.select().from(auditEvent).where(eq(auditEvent.targetId, created.id)),
    );
    assert.strictEqual(audits.length, 1);
    assert.strictEqual(audits[0]?.action, "inquiry_replied");
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("aggregates inquiry counts by status and day", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "member" });
    const created = yield* createMemberInquiry("member", { body: "本文", subject: "件名" });
    yield* addUser({ role: ROLE.administrator, userId: "admin" });
    const sessionId = yield* addSession({ audience: APPLICATION.admin, userId: "admin" });
    yield* replyAsAdmin(sessionId, created.id, "返信です");
    yield* createMemberInquiry("member", { body: "2件目", subject: "2件目" });
    const closed = yield* createMemberInquiry("member", { body: "3件目", subject: "3件目" });
    yield* closeInquiry(sessionId, closed.id);
    const counts = yield* staffInquiryCounts();
    assert.strictEqual(counts.byStatus.open, 1);
    assert.strictEqual(counts.byStatus.answered, 1);
    assert.strictEqual(counts.byStatus.closed, 1);
    assert.isAtLeast(counts.trend.length, 1);
    const pending = yield* countPendingInquiries(sessionId);
    assert.strictEqual(pending, 1);
  }).pipe(Effect.provide(TestDatabase)),
);
