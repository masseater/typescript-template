import { count, eq } from "drizzle-orm";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { AdminStrongSessionRequired } from "./admin-strong-session-required.ts";
import {
  deleteUser,
  LastAdminRequired,
  listUsers,
  setUserRole,
  TargetUnavailable,
} from "./admin.ts";
import { query } from "./database.ts";
import { account, auditEvent, user } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";
import { addCredential, addSession, addUser, recordedAt, TestDatabase } from "./testing.ts";

describe("listUsers", () => {
  describe.for([
    ["a session that signed in without a second factor", "admin", false],
    ["a session opened for the user application", "user", true],
  ] as const)("an administrator reading through %s", ([, audience, strong]) => {
    const it = test.extend("refusal", async () =>
      Effect.runPromise(
        Effect.gen(function* weakRead() {
          yield* addUser({ role: "admin", userId: "administrator" });
          const sessionId = yield* addSession({ audience, strong, userId: "administrator" });
          return yield* Effect.flip(listUsers(sessionId, { limit: 50, offset: 0 }));
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is refused until the session is a strong admin session", ({ refusal }) => {
      expect(refusal).toStrictEqual(new AdminStrongSessionRequired());
    });
  });

  describe("an administrator reading through a strong admin session", () => {
    const it = test.extend("userPage", async () =>
      Effect.runPromise(
        Effect.gen(function* strongRead() {
          yield* addUser({ role: "admin", userId: "administrator" });
          const sessionId = yield* addSession({ audience: "admin", userId: "administrator" });
          return yield* listUsers(sessionId, { limit: 50, offset: 0 });
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("reads every user", ({ userPage }) => {
      expect(userPage).toStrictEqual({
        total: 1,
        users: [
          {
            createdAt: recordedAt,
            email: "administrator@example.com",
            emailVerified: true,
            id: "administrator",
            name: "administrator",
            role: "admin",
            twoFactorEnabled: false,
          },
        ],
      });
    });
  });
});

describe("setUserRole", () => {
  describe.for([
    ["admin", "admin"],
    ["user", "user"],
  ] as const)("a demoted administrator's %s session", ([, audience]) => {
    const it = test.extend("demotedSession", async () =>
      Effect.runPromise(
        Effect.gen(function* demote() {
          yield* addUser({ role: "admin", userId: "actor" });
          yield* addUser({ role: "admin", userId: "target" });
          const actorSession = yield* addSession({ audience: "admin", userId: "actor" });
          const targetSession = yield* addSession({ audience, userId: "target" });
          yield* setUserRole({ role: "user", sessionId: actorSession, targetId: "target" });
          return yield* getSessionSecurity(targetSession, audience);
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("stops being a live session at once", ({ demotedSession }) => {
      expect(demotedSession).toBe(null);
    });
  });

  describe("the only administrator demoting themselves", () => {
    const it = test.extend("refusal", async () =>
      Effect.runPromise(
        Effect.gen(function* demoteLast() {
          yield* addUser({ role: "admin", userId: "last" });
          const sessionId = yield* addSession({ audience: "admin", userId: "last" });
          return yield* Effect.flip(setUserRole({ role: "user", sessionId, targetId: "last" }));
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is refused", ({ refusal }) => {
      expect(refusal).toStrictEqual(new LastAdminRequired());
    });
  });

  describe("two administrators demoting themselves at the same time", () => {
    const it = test.extend("remainingAdmins", async () =>
      Effect.runPromise(
        Effect.gen(function* demoteBoth() {
          yield* addUser({ role: "admin", userId: "first" });
          yield* addUser({ role: "admin", userId: "second" });
          const first = yield* addSession({ audience: "admin", userId: "first" });
          const second = yield* addSession({ audience: "admin", userId: "second" });
          yield* Effect.all(
            [
              Effect.exit(setUserRole({ role: "user", sessionId: first, targetId: "first" })),
              Effect.exit(setUserRole({ role: "user", sessionId: second, targetId: "second" })),
            ],
            { concurrency: "unbounded" },
          );
          return yield* query(async (database) =>
            database.select({ count: count() }).from(user).where(eq(user.role, "admin")),
          );
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("leaves one administrator standing", ({ remainingAdmins }) => {
      expect(remainingAdmins).toStrictEqual([{ count: 1 }]);
    });
  });

  describe("a role change for a user who does not exist", () => {
    const it = test.extend("refusal", async () =>
      Effect.runPromise(
        Effect.gen(function* changeMissing() {
          yield* addUser({ role: "admin", userId: "actor" });
          const sessionId = yield* addSession({ audience: "admin", userId: "actor" });
          return yield* Effect.flip(setUserRole({ role: "admin", sessionId, targetId: "missing" }));
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is refused as an unavailable target", ({ refusal }) => {
      expect(refusal).toStrictEqual(new TargetUnavailable());
    });
  });

  describe("a role change that lands", () => {
    const it = test.extend("auditCount", async () =>
      Effect.runPromise(
        Effect.gen(function* changeAndAudit() {
          yield* addUser({ role: "admin", userId: "actor" });
          yield* addUser({ userId: "target" });
          const sessionId = yield* addSession({ audience: "admin", userId: "actor" });
          yield* Effect.exit(setUserRole({ role: "admin", sessionId, targetId: "missing" }));
          yield* setUserRole({ role: "admin", sessionId, targetId: "target" });
          return yield* query(async (database) =>
            database.select({ count: count() }).from(auditEvent),
          );
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("leaves one audit record, and none for the change that missed", ({ auditCount }) => {
      expect(auditCount).toStrictEqual([{ count: 1 }]);
    });
  });
});

describe("deleteUser", () => {
  describe("the only administrator deleting themselves", () => {
    const it = test.extend("refusal", async () =>
      Effect.runPromise(
        Effect.gen(function* deleteLast() {
          yield* addUser({ role: "admin", userId: "last" });
          const sessionId = yield* addSession({ audience: "admin", userId: "last" });
          return yield* Effect.flip(deleteUser(sessionId, "last"));
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is refused", ({ refusal }) => {
      expect(refusal).toStrictEqual(new LastAdminRequired());
    });
  });

  describe("a refused deletion of the only administrator", () => {
    const it = test.extend("keptRecords", async () =>
      Effect.runPromise(
        Effect.gen(function* keepLast() {
          yield* addUser({ role: "admin", userId: "last" });
          yield* addCredential("last");
          const sessionId = yield* addSession({ audience: "admin", userId: "last" });
          yield* Effect.exit(deleteUser(sessionId, "last"));
          yield* Effect.exit(setUserRole({ role: "user", sessionId, targetId: "last" }));
          return yield* query(async (database) =>
            database
              .select({ credentials: count(account.id), role: user.role })
              .from(user)
              .leftJoin(account, eq(account.userId, user.id))
              .where(eq(user.id, "last"))
              .groupBy(user.id),
          );
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("keeps the administrator's role and credential untouched", ({ keptRecords }) => {
      expect(keptRecords).toStrictEqual([{ credentials: 1, role: "admin" }]);
    });
  });

  describe("a refused change to the only administrator", () => {
    const it = test.extend("auditCount", async () =>
      Effect.runPromise(
        Effect.gen(function* refuseAndAudit() {
          yield* addUser({ role: "admin", userId: "last" });
          const sessionId = yield* addSession({ audience: "admin", userId: "last" });
          yield* Effect.exit(setUserRole({ role: "user", sessionId, targetId: "last" }));
          yield* Effect.exit(deleteUser(sessionId, "last"));
          return yield* query(async (database) =>
            database.select({ count: count() }).from(auditEvent),
          );
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("leaves no audit record behind", ({ auditCount }) => {
      expect(auditCount).toStrictEqual([{ count: 0 }]);
    });
  });

  describe("a deleted member's session", () => {
    const it = test.extend("deletedSession", async () =>
      Effect.runPromise(
        Effect.gen(function* deleteMember() {
          yield* addUser({ role: "admin", userId: "actor" });
          yield* addUser({ userId: "target" });
          const actorSession = yield* addSession({ audience: "admin", userId: "actor" });
          const targetSession = yield* addSession({ audience: "user", userId: "target" });
          yield* deleteUser(actorSession, "target");
          return yield* getSessionSecurity(targetSession, "user");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is gone with the user", ({ deletedSession }) => {
      expect(deletedSession).toBe(null);
    });
  });

  describe("deleting the same member twice", () => {
    const it = test.extend("refusal", async () =>
      Effect.runPromise(
        Effect.gen(function* deleteTwice() {
          yield* addUser({ role: "admin", userId: "actor" });
          yield* addUser({ userId: "target" });
          const sessionId = yield* addSession({ audience: "admin", userId: "actor" });
          yield* deleteUser(sessionId, "target");
          return yield* Effect.flip(deleteUser(sessionId, "target"));
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("refuses the second deletion as an unavailable target", ({ refusal }) => {
      expect(refusal).toStrictEqual(new TargetUnavailable());
    });
  });
});
