import { APPLICATION, ROLE } from "@repo/config";
import { count, eq } from "drizzle-orm";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { query } from "./database.ts";
import { withdrawnMember } from "./member-leave-schema.ts";
import {
  purgeExpiredWithdrawnMembers,
  recoverWithdrawnMember,
  withdrawMember,
} from "./member-leave.ts";
import { addOAuthGrant, addSession, addUser } from "./records-fixture.ts";
import {
  leaveRequest as leaveRequestTable,
  oauthAccessToken,
  oauthConsent,
  oauthRefreshToken,
  schema,
  session,
} from "./schema.ts";
import { findUser, getSessionSecurity } from "./security.ts";
import { TestDatabase } from "./testing.ts";

const { user } = schema;

const runTest = <Value>(
  program: Effect.Effect<Value, unknown, Effect.Effect.Context<Value>>,
): Promise<Value> => Effect.runPromise(program.pipe(Effect.provide(TestDatabase)));

const countWithdrawnMember = (memberId: string) =>
  query(async (database) => {
    const [row] = await database
      .select({ count: count() })
      .from(withdrawnMember)
      .where(eq(withdrawnMember.memberId, memberId));
    return row?.count ?? 0;
  });

const countOAuthGrants = (memberId: string) =>
  Effect.gen(function* grants() {
    const access = yield* query((database) =>
      database
        .select({ id: oauthAccessToken.id })
        .from(oauthAccessToken)
        .where(eq(oauthAccessToken.userId, memberId)),
    );
    const refresh = yield* query((database) =>
      database
        .select({ id: oauthRefreshToken.id })
        .from(oauthRefreshToken)
        .where(eq(oauthRefreshToken.userId, memberId)),
    );
    const consent = yield* query((database) =>
      database
        .select({ id: oauthConsent.id })
        .from(oauthConsent)
        .where(eq(oauthConsent.userId, memberId)),
    );
    return { access: access.length, consent: consent.length, refresh: refresh.length };
  });

const countLiveSessions = (memberId: string) =>
  query(async (database) => {
    const sessions = await database
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, memberId));
    return sessions.length;
  });

const getMember = (viewerId: string, memberId: string) =>
  Effect.gen(function* loadMember() {
    const [member] = yield* query((database) =>
      database
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(eq(user.id, memberId))
        .limit(1),
    );
    return member ?? null;
  });

describe("withdrawMember", () => {
  describe("a member who leaves with retention", () => {
    const it = test.extend("leftMember", async () =>
      runTest(
        Effect.gen(function* leaveMember() {
          yield* addUser({ userId: "leaver" });
          yield* addSession({ audience: APPLICATION.user, userId: "leaver" });
          yield* addOAuthGrant("leaver");
          const sessionId = yield* addSession({ audience: APPLICATION.user, userId: "leaver" });
          yield* withdrawMember("leaver", { immediate: false });
          return {
            grants: yield* countOAuthGrants("leaver"),
            liveSession: yield* getSessionSecurity(sessionId, APPLICATION.user),
            member: yield* findUser("leaver"),
            visibleToOther: yield* getMember("viewer", "leaver"),
            withdrawn: yield* countWithdrawnMember("leaver"),
          };
        }),
      ));

    it("removes live sessions and OAuth tokens", ({ leftMember }) => {
      expect(leftMember.liveSession).toBe(null);
      expect(leftMember.grants).toStrictEqual({ access: 0, consent: 0, refresh: 0 });
    });

    it("moves the member out of the active directory", ({ leftMember }) => {
      expect(leftMember.member).toBe(null);
      expect(leftMember.visibleToOther).toBe(null);
      expect(leftMember.withdrawn).toBe(1);
    });
  });

  describe("a member who leaves with immediate deletion", () => {
    const it = test.extend("deletedMember", async () =>
      runTest(
        Effect.gen(function* deleteMember() {
          yield* addUser({ userId: "gone" });
          yield* withdrawMember("gone", { immediate: true });
          return {
            member: yield* findUser("gone"),
            withdrawn: yield* countWithdrawnMember("gone"),
          };
        }),
      ));

    it("does not keep a withdrawn snapshot", ({ deletedMember }) => {
      expect(deletedMember.member).toBe(null);
      expect(deletedMember.withdrawn).toBe(0);
    });
  });
});

describe("recoverWithdrawnMember", () => {
  describe("within the retention window", () => {
    const it = test.extend("restoredMember", async () =>
      runTest(
        Effect.gen(function* restoreMember() {
          yield* addUser({ userId: "returning" });
          yield* withdrawMember("returning", { immediate: false });
          const restored = yield* recoverWithdrawnMember("returning@example.com");
          return {
            member: yield* findUser("returning"),
            restored,
            withdrawn: yield* countWithdrawnMember("returning"),
          };
        }),
      ));

    it("restores the active member record", ({ restoredMember }) => {
      expect(restoredMember.member?.id).toBe("returning");
      expect(restoredMember.withdrawn).toBe(0);
      expect(restoredMember.restored.memberId).toBe("returning");
    });
  });
});

describe("purgeExpiredWithdrawnMembers", () => {
  describe("after the retention window", () => {
    const it = test.extend("purgedMember", async () =>
      runTest(
        Effect.gen(function* purgeMember() {
          yield* addUser({ userId: "expired" });
          yield* withdrawMember("expired", { immediate: false });
          yield* query((database) =>
            database
              .update(leaveRequestTable)
              .set({ purgeAt: new Date("2020-01-01T00:00:00.000Z") })
              .where(eq(leaveRequestTable.memberId, "expired")),
          );
          const purged = yield* purgeExpiredWithdrawnMembers(new Date("2026-01-02T00:00:00.000Z"));
          return {
            purged,
            withdrawn: yield* countWithdrawnMember("expired"),
          };
        }),
      ));

    it("removes the withdrawn snapshot", ({ purgedMember }) => {
      expect(purgedMember.purged.count).toBe(1);
      expect(purgedMember.purged.memberIds).toStrictEqual(["expired"]);
      expect(purgedMember.withdrawn).toBe(0);
    });
  });
});

describe("countLiveSessions", () => {
  describe("a member whose sessions were revoked on leave", () => {
    const it = test.extend("sessionCount", async () =>
      runTest(
        Effect.gen(function* countSessions() {
          yield* addUser({ role: ROLE.member, userId: "leaver" });
          yield* addSession({ audience: APPLICATION.user, userId: "leaver" });
          yield* withdrawMember("leaver", { immediate: false });
          return yield* countLiveSessions("leaver");
        }),
      ));

    it("reports zero live sessions", ({ sessionCount }) => {
      expect(sessionCount).toBe(0);
    });
  });
});
