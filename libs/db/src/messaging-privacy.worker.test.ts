import { assert, it } from "@effect/vitest";
import { APPLICATION, ROLE } from "@repo/config";
import { DateTime, Effect, Schema } from "effect";

import { getMember, listUsers } from "./admin.ts";
import { dashboardStaff } from "./dashboard-staff.ts";
import { query } from "./database.ts";
import { CONVERSATION_KIND } from "./messaging-schema.ts";
import { addSession, addUser } from "./records-fixture.ts";
import { conversation, conversationParticipant, directMessage } from "./schema.ts";
import { TestDatabase } from "./testing.ts";

const secretBody = "ADMIN_MUST_NOT_READ_THIS_DIRECT_MESSAGE";

const adminSession = Effect.fn("adminSession")(function* adminSession(userId: string) {
  yield* addUser({ role: ROLE.administrator, userId });
  return yield* addSession({ audience: APPLICATION.admin, userId });
});

const seedSecret = Effect.fn("seedSecret")(function* seedSecret() {
  yield* addUser({ userId: "sender" });
  yield* addUser({ userId: "recipient" });
  const now = DateTime.toDate(DateTime.makeUnsafe("2026-09-20T00:00:00.000Z"));
  yield* query((database) =>
    database
      .insert(conversation)
      .values({
        directKey: "recipient:sender",
        id: "thread",
        kind: CONVERSATION_KIND.direct,
        lastMessageAt: now,
      })
      .then(() =>
        database.insert(conversationParticipant).values([
          {
            conversationId: "thread",
            id: "part-sender",
            joinedAt: now,
            memberId: "sender",
            memberName: "sender",
          },
          {
            conversationId: "thread",
            id: "part-recipient",
            joinedAt: now,
            memberId: "recipient",
            memberName: "recipient",
          },
        ]),
      )
      .then(() =>
        database.insert(directMessage).values({
          body: secretBody,
          conversationId: "thread",
          createdAt: now,
          id: "message",
          senderId: "sender",
          senderName: "sender",
        }),
      )
      .then(() => undefined),
  );
});

it.effect("admin and staff reads never include direct message bodies", () =>
  Effect.gen(function* program() {
    yield* seedSecret();
    const sessionId = yield* adminSession("operator");
    const listed = yield* listUsers(sessionId, { limit: 20, offset: 0 });
    const member = yield* getMember(sessionId, "sender");
    const overview = yield* dashboardStaff.overviewWithoutPii();
    const audit = yield* dashboardStaff.auditEvents({ limit: 20, offset: 0 });
    const serialized = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
      audit,
      listed,
      member,
      overview,
    });
    assert.isFalse(serialized.includes(secretBody));
  }).pipe(Effect.provide(TestDatabase)),
);
