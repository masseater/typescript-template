import { assert, it } from "@effect/vitest";
import { APPLICATION, ROLE } from "@repo/config";
import { Effect } from "effect";

import { listAgreementVersions, listUsers, readAgreementVersion } from "./admin.ts";
import { startInterview } from "./interview.ts";
import { addSession, addUser } from "./records-fixture.ts";
import { TestDatabase } from "./testing.ts";

const conversationToken = "ADMIN_MUST_NOT_READ_THIS_CONVERSATION";

const adminSession = Effect.fn("adminSession")(function* adminSession(userId: string) {
  yield* addUser({ role: ROLE.administrator, userId });
  return yield* addSession({ audience: APPLICATION.admin, userId });
});

it.effect("admin user listing never exposes interview conversation content", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "member" });
    yield* startInterview("member", {
      messages: [{ role: "member", text: conversationToken }],
      phase: "saved",
      sheet: { nickname: "たろう" },
      skipped: [],
    });
    const sessionId = yield* adminSession("admin");
    const listed = yield* listUsers(sessionId, { limit: 20, offset: 0 });
    assert.isFalse(JSON.stringify(listed).includes(conversationToken));
  }).pipe(Effect.provide(TestDatabase)),
);

it.effect("admin agreement reads never expose interview conversation content", () =>
  Effect.gen(function* program() {
    yield* addUser({ userId: "member" });
    yield* startInterview("member", {
      messages: [{ role: "member", text: conversationToken }],
      phase: "saved",
      sheet: {},
      skipped: [],
    });
    const sessionId = yield* adminSession("admin");
    const listed = yield* listAgreementVersions(sessionId);
    const serialized = JSON.stringify(listed);
    assert.isFalse(serialized.includes(conversationToken));
    const [version] = listed.versions;
    if (version !== undefined) {
      const read = yield* readAgreementVersion(sessionId, version.version);
      assert.isFalse(JSON.stringify(read).includes(conversationToken));
    }
  }).pipe(Effect.provide(TestDatabase)),
);
