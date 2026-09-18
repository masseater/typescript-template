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

const directoryRows = {
  actor: {
    createdAt: new Date("2026-09-01"),
    email: "actor@example.com",
    emailVerified: true,
    id: "actor",
    name: "管理者",
    role: "admin",
    twoFactorEnabled: false,
  },
  alice: {
    createdAt: new Date("2026-09-02"),
    email: "alice@example.com",
    emailVerified: true,
    id: "alice",
    name: "Alice",
    role: "user",
    twoFactorEnabled: false,
  },
  bob: {
    createdAt: new Date("2026-09-03"),
    email: "bob@example.net",
    emailVerified: false,
    id: "bob",
    name: "Bob",
    role: "user",
    twoFactorEnabled: false,
  },
  sale: {
    createdAt: new Date("2026-09-04"),
    email: "sale@example.com",
    emailVerified: true,
    id: "sale",
    name: "50%_off",
    role: "user",
    twoFactorEnabled: false,
  },
  carol: {
    createdAt: new Date("2026-09-05"),
    email: "carol@example.org",
    emailVerified: true,
    id: "carol",
    name: "山田 花子",
    role: "admin",
    twoFactorEnabled: false,
  },
  dave: {
    createdAt: new Date("2026-09-06"),
    email: "dave@example.com",
    emailVerified: true,
    id: "dave",
    name: "Dave",
    role: "user",
    twoFactorEnabled: true,
  },
} as const;

describe("listUsers over a directory of six users", () => {
  describe.for([
    [
      "the first page of two",
      { limit: 2, offset: 0 },
      [directoryRows.dave, directoryRows.carol],
      6,
    ],
    [
      "the last page of two",
      { limit: 2, offset: 4 },
      [directoryRows.alice, directoryRows.actor],
      6,
    ],
    ["the page past the end", { limit: 2, offset: 6 }, [], 6],
    ["a name in another case", { keyword: "ALI", limit: 50, offset: 0 }, [directoryRows.alice], 1],
    [
      "a part of an email",
      { keyword: "example.net", limit: 50, offset: 0 },
      [directoryRows.bob],
      1,
    ],
    ["a Japanese name", { keyword: "花子", limit: 50, offset: 0 }, [directoryRows.carol], 1],
    ["a percent sign", { keyword: "%", limit: 50, offset: 0 }, [directoryRows.sale], 1],
    ["an underscore", { keyword: "_", limit: 50, offset: 0 }, [directoryRows.sale], 1],
    ["a backslash", { keyword: "\\", limit: 50, offset: 0 }, [], 0],
    [
      "the admin role",
      { limit: 50, offset: 0, role: "admin" },
      [directoryRows.carol, directoryRows.actor],
      2,
    ],
    ["unverified email", { emailVerified: false, limit: 50, offset: 0 }, [directoryRows.bob], 1],
    [
      "verified users with a matching email on the second page",
      { emailVerified: true, keyword: "example.com", limit: 1, offset: 1, role: "user" },
      [directoryRows.sale],
      3,
    ],
  ] as const)("read by %s", ([, page, expectedUsers, expectedTotal]) => {
    const it = test.extend("userPage", async () =>
      Effect.runPromise(
        Effect.gen(function* readDirectory() {
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values(
              Object.values(directoryRows).map((directoryRow) => ({
                ...directoryRow,
                updatedAt: directoryRow.createdAt,
              })),
            );
          });
          const sessionId = yield* addSession({ audience: "admin", userId: "actor" });
          return yield* listUsers(sessionId, page);
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("lists the matches newest first and counts only the matches", ({ userPage }) => {
      expect(userPage).toStrictEqual({ total: expectedTotal, users: expectedUsers });
    });
  });
});
