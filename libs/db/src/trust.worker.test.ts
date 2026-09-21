import { assert, it } from "@effect/vitest";
import {
  APPLICATION,
  MODERATION_KIND,
  REPORT_REASON,
  REPORT_STATUS,
  REPORT_SUBJECT,
  ROLE,
} from "@repo/config";
import { AUDIT_ACTION, CONVERSATION_KIND, fileReport, query, schema } from "@repo/db";
import { dismissReport, listReports, readReport, suspendTarget } from "@repo/db/admin";
import { TestDatabase, addSession, addUser } from "@repo/db/testing";
import { eq } from "drizzle-orm";
import { Effect } from "effect";

const { auditEvent, conversation, conversationParticipant, directMessage, user } = schema;
const recordedAt = new Date("2026-01-01T00:00:00.000Z");
const secret = "これは通報されていない本文です。";
const reported = "これは通報された本文です。";

it.effect("shows an administrator only the reported message, then records a suspension", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "reporter" });
    yield* addUser({ userId: "author" });
    yield* addUser({ role: ROLE.administrator, userId: "operator" });
    const sessionId = yield* addSession({
      audience: APPLICATION.admin,
      userId: "operator",
    });
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
          id: "part-reporter",
          joinedAt: recordedAt,
          memberId: "reporter",
          memberName: "reporter",
        },
        {
          conversationId: "thread",
          id: "part-author",
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
    });
    const filed = yield* fileReport(
      "reporter",
      { id: "reported-message", kind: REPORT_SUBJECT.message },
      REPORT_REASON.harassment,
    );
    const listed = yield* listReports(sessionId, { limit: 20, offset: 0 });
    const detail = yield* readReport(sessionId, filed.id);
    const visible = JSON.stringify({ detail, listed });
    assert.strictEqual(detail.body, reported);
    assert.strictEqual(detail.status, REPORT_STATUS.open);
    assert.notInclude(visible, secret);
    assert.strictEqual(listed.reports.length, 1);
    yield* suspendTarget(sessionId, filed.id, true);
    const [suspended] = yield* query((database) =>
      database.select({ accountState: user.accountState }).from(user).where(eq(user.id, "author")),
    );
    assert.strictEqual(suspended?.accountState, "suspended");
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
    const after = yield* readReport(sessionId, filed.id);
    assert.strictEqual(after.status, REPORT_STATUS.actioned);
    assert.strictEqual(after.actions[0]?.kind, MODERATION_KIND.suspend);
    yield* dismissReport(sessionId, filed.id);
    assert.strictEqual((yield* readReport(sessionId, filed.id)).status, REPORT_STATUS.dismissed);
  }).pipe(Effect.provide(TestDatabase)),
);
