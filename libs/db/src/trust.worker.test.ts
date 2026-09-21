import { assert, it } from "@effect/vitest";
import {
  APPLICATION,
  CONVERSATION_KIND,
  MODERATION_KIND,
  REPORT_REASON,
  REPORT_STATUS,
  REPORT_SUBJECT,
  ROLE,
} from "@repo/config";
import { AUDIT_ACTION, fileReport, query, schema } from "@repo/db";
import { dismissReport, listReports, readReport, suspendTarget } from "@repo/db/admin";
import { TestDatabase } from "@repo/db/testing";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

import type { Database, DatabaseFailure } from "@repo/db";

const { auditEvent, conversation, conversationParticipant, directMessage, session, user } = schema;
const recordedAt = new Date("2026-01-01T00:00:00.000Z");
const secret = "これは通報されていない本文です。";
const reported = "これは通報された本文です。";

const addUser = (added: {
  readonly userId: string;
  readonly role?: "admin" | "member";
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: recordedAt,
      email: `${added.userId}@example.com`,
      emailVerified: true,
      id: added.userId,
      name: added.userId,
      role: added.role ?? ROLE.member,
      updatedAt: recordedAt,
    });
  });

it.effect("shows an administrator only the reported message, then records a suspension", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "reporter" });
    yield* addUser({ userId: "author" });
    yield* addUser({ role: ROLE.administrator, userId: "operator" });
    yield* query(async (database) => {
      await database.insert(conversation).values({
        directKey: "author:reporter",
        id: "thread",
        kind: CONVERSATION_KIND.direct,
        lastMessageAt: recordedAt,
      });
      await database.insert(conversationParticipant).values([
        {
          conversationId: "thread",
          joinedAt: recordedAt,
          memberId: "reporter",
          memberName: "reporter",
        },
        {
          conversationId: "thread",
          joinedAt: recordedAt,
          memberId: "author",
          memberName: "author",
        },
      ]);
      await database.insert(directMessage).values([
        {
          body: secret,
          conversationId: "thread",
          createdAt: recordedAt,
          id: "secret-message",
          senderId: "author",
          senderName: "author",
        },
        {
          body: reported,
          conversationId: "thread",
          createdAt: new Date(recordedAt.getTime() + 1),
          id: "reported-message",
          senderId: "author",
          senderName: "author",
        },
      ]);
      await database.insert(session).values({
        audience: APPLICATION.admin,
        authenticationMethod: "password_totp",
        createdAt: recordedAt,
        expiresAt: new Date("2027-01-01T00:00:00.000Z"),
        id: "operator-session",
        securityVersion: 0,
        token: "operator-token",
        updatedAt: recordedAt,
        userId: "operator",
      });
    });
    const filed = yield* fileReport(
      "reporter",
      { id: "reported-message", kind: REPORT_SUBJECT.message },
      REPORT_REASON.harassment,
    );
    const listed = yield* listReports("operator-session", { limit: 20, offset: 0 });
    const detail = yield* readReport("operator-session", filed.id);
    const visible = JSON.stringify({ detail, listed });
    assert.strictEqual(detail.body, reported);
    assert.strictEqual(detail.status, REPORT_STATUS.open);
    assert.notInclude(visible, secret);
    assert.strictEqual(listed.reports.length, 1);
    yield* suspendTarget("operator-session", filed.id, true);
    const [suspended] = yield* query((database) =>
      database.select({ suspended: user.suspended }).from(user).where(eq(user.id, "author")),
    );
    assert.isTrue(suspended?.suspended);
    const [audit] = yield* query((database) =>
      database
        .select({ action: auditEvent.action, targetId: auditEvent.targetId })
        .from(auditEvent)
        .where(eq(auditEvent.actorId, "operator")),
    );
    assert.deepStrictEqual(audit, {
      action: AUDIT_ACTION.memberSuspended,
      targetId: "author",
    });
    const after = yield* readReport("operator-session", filed.id);
    assert.strictEqual(after.status, REPORT_STATUS.actioned);
    assert.strictEqual(after.actions[0]?.kind, MODERATION_KIND.suspend);
    yield* dismissReport("operator-session", filed.id);
    assert.strictEqual(
      (yield* readReport("operator-session", filed.id)).status,
      REPORT_STATUS.dismissed,
    );
  }).pipe(Effect.provide(TestDatabase)),
);
