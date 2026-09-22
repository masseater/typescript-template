import { APPLICATION, ROLE } from "@repo/config";
import { count, eq } from "drizzle-orm";
import { DateTime, Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { agreementAcceptance, agreementVersion } from "./agreement-schema.ts";
import { Database, query } from "./database.ts";
import { withdrawnMember } from "./member-leave-schema.ts";
import {
  acceptRecovery,
  declineRecovery,
  findRecoveryOffer,
  purgeExpiredWithdrawnMembers,
  withdrawMember,
} from "./member-leave.ts";
import { addOAuthGrant, addSession, addUser, oauthGrantCounts } from "./records-fixture.ts";
import { leaveRequest as leaveRequestTable, schema, session } from "./schema.ts";
import { findUser, getSessionSecurity } from "./security.ts";
import { TestDatabase } from "./testing.ts";

import type { Layer } from "effect";
import type { DatabaseFailure } from "./database-failure.ts";

const { user } = schema;

const runTest = <Value>(
  program: Effect.Effect<Value, unknown, Layer.Success<typeof TestDatabase>>,
): Promise<Value> => Effect.runPromise(program.pipe(Effect.provide(TestDatabase)));

const addMember = (added: {
  readonly userId: string;
  readonly email: string;
  readonly name?: string;
  readonly profile?: string;
}): Effect.Effect<void, DatabaseFailure, Database> =>
  query((database) =>
    database
      .insert(user)
      .values({
        createdAt: DateTime.toDate(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z")),
        email: added.email,
        emailVerified: true,
        id: added.userId,
        name: added.name ?? added.userId,
        profile: added.profile ?? "",
        role: ROLE.member,
        socialLinks: [],
        updatedAt: DateTime.toDate(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z")),
      })
      .then(() => undefined),
  );

const countWithdrawnMember = (memberId: string) =>
  query((database) =>
    database
      .select({ count: count() })
      .from(withdrawnMember)
      .where(eq(withdrawnMember.memberId, memberId))
      .then((rows) => {
        const [row] = rows;
        return row?.count ?? 0;
      }),
  );

const countLiveSessions = (memberId: string) =>
  query((database) =>
    database
      .select({ id: session.id })
      .from(session)
      .where(eq(session.userId, memberId))
      .then((sessions) => sessions.length),
  );

const getMember = (memberId: string) =>
  Effect.gen(function* loadMember() {
    const [member] = yield* query((database) =>
      database
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(eq(user.id, memberId))
        .limit(1),
    );
    return member;
  });

describe("withdrawMember", () => {
  describe("a member who leaves with retention", () => {
    const it = test.extend("leftMember", () =>
      runTest(
        Effect.gen(function* leaveMember() {
          yield* addUser({ userId: "leaver" });
          yield* addSession({ audience: APPLICATION.user, userId: "leaver" });
          yield* addOAuthGrant("leaver");
          const sessionId = yield* addSession({ audience: APPLICATION.user, userId: "leaver" });
          yield* withdrawMember("leaver", { immediate: false });
          return {
            grants: yield* oauthGrantCounts("leaver"),
            liveSession: yield* getSessionSecurity(sessionId, APPLICATION.user),
            member: yield* findUser("leaver"),
            stillListed: yield* getMember("leaver"),
            withdrawn: yield* countWithdrawnMember("leaver"),
          };
        }),
      ));

    it("removes live sessions and OAuth tokens", ({ leftMember }) => {
      expect(leftMember.liveSession).toBeUndefined();
      expect(leftMember.grants).toStrictEqual({ access: 0, consent: 0, refresh: 0 });
    });

    it("moves the member out of the active directory", ({ leftMember }) => {
      expect(leftMember.member).toBeUndefined();
      expect(leftMember.stillListed).toBeUndefined();
      expect(leftMember.withdrawn).toBe(1);
    });
  });

  describe("a member who leaves with immediate deletion", () => {
    const it = test.extend("deletedMember", () =>
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
      expect(deletedMember.member).toBeUndefined();
      expect(deletedMember.withdrawn).toBe(0);
    });
  });
});

describe("findRecoveryOffer", () => {
  describe("a new member with the same verified email as a withdrawn snapshot", () => {
    const it = test.extend("offer", () =>
      runTest(
        Effect.gen(function* loadOffer() {
          yield* addMember({
            email: "returning@example.com",
            name: "Former Name",
            profile: "former profile",
            userId: "former",
          });
          yield* withdrawMember("former", { immediate: false });
          yield* addMember({ email: "returning@example.com", userId: "newcomer" });
          return yield* findRecoveryOffer("newcomer");
        }),
      ));

    it("shows the recovery offer", ({ offer }) => {
      expect(offer).toStrictEqual({ available: true, previousName: "Former Name" });
    });
  });

  describe("two withdrawn snapshots for the same email", () => {
    const it = test.extend("offer", () =>
      runTest(
        Effect.gen(function* loadOffer() {
          yield* addMember({
            email: "returning@example.com",
            name: "Older Name",
            userId: "older",
          });
          yield* withdrawMember("older", { immediate: false });
          yield* addMember({
            email: "returning@example.com",
            name: "Newer Name",
            userId: "newer",
          });
          yield* withdrawMember("newer", { immediate: false });
          yield* query((database) =>
            database
              .update(withdrawnMember)
              .set({ withdrawnAt: DateTime.toDate(DateTime.makeUnsafe("2020-01-01T00:00:00.000Z")) })
              .where(eq(withdrawnMember.memberId, "older")),
          );
          yield* addMember({ email: "returning@example.com", userId: "newcomer" });
          return yield* findRecoveryOffer("newcomer");
        }),
      ));

    it("offers the latest snapshot", ({ offer }) => {
      expect(offer).toStrictEqual({ available: true, previousName: "Newer Name" });
    });
  });

  describe("a member with a different email", () => {
    const it = test.extend("offer", () =>
      runTest(
        Effect.gen(function* loadOffer() {
          yield* addMember({ email: "former@example.com", userId: "former" });
          yield* withdrawMember("former", { immediate: false });
          yield* addMember({ email: "other@example.com", userId: "other" });
          return yield* findRecoveryOffer("other");
        }),
      ));

    it("shows no offer", ({ offer }) => {
      expect(offer).toStrictEqual({ available: false });
    });
  });

  describe("an expired withdrawn snapshot", () => {
    const it = test.extend("offer", () =>
      runTest(
        Effect.gen(function* loadOffer() {
          yield* addMember({ email: "returning@example.com", userId: "former" });
          yield* withdrawMember("former", { immediate: false });
          yield* query((database) =>
            database
              .update(leaveRequestTable)
              .set({ purgeAt: DateTime.toDate(DateTime.makeUnsafe("2020-01-01T00:00:00.000Z")) })
              .where(eq(leaveRequestTable.memberId, "former")),
          );
          yield* addMember({ email: "returning@example.com", userId: "newcomer" });
          return yield* findRecoveryOffer("newcomer");
        }),
      ));

    it("shows no offer", ({ offer }) => {
      expect(offer).toStrictEqual({ available: false });
    });
  });

  describe("a purged withdrawn snapshot", () => {
    const it = test.extend("offer", () =>
      runTest(
        Effect.gen(function* loadOffer() {
          yield* addMember({ email: "returning@example.com", userId: "former" });
          yield* withdrawMember("former", { immediate: false });
          yield* query((database) =>
            database
              .update(leaveRequestTable)
              .set({ purgeAt: DateTime.toDate(DateTime.makeUnsafe("2020-01-01T00:00:00.000Z")) })
              .where(eq(leaveRequestTable.memberId, "former")),
          );
          yield* purgeExpiredWithdrawnMembers(DateTime.toDate(DateTime.makeUnsafe("2026-01-02T00:00:00.000Z")));
          yield* addMember({ email: "returning@example.com", userId: "newcomer" });
          return yield* findRecoveryOffer("newcomer");
        }),
      ));

    it("shows no offer", ({ offer }) => {
      expect(offer).toStrictEqual({ available: false });
    });
  });
});

describe("acceptRecovery", () => {
  describe("within the retention window", () => {
    const it = test.extend("restoredMember", () =>
      runTest(
        Effect.gen(function* restoreMember() {
          yield* addMember({
            email: "returning@example.com",
            name: "Former Name",
            profile: "former profile",
            userId: "former",
          });
          yield* withdrawMember("former", { immediate: false });
          yield* addMember({ email: "returning@example.com", userId: "newcomer" });
          yield* acceptRecovery("newcomer");
          return {
            member: yield* findUser("newcomer"),
            offer: yield* findRecoveryOffer("newcomer"),
            withdrawn: yield* countWithdrawnMember("former"),
          };
        }),
      ));

    it("restores the profile onto the new member id", ({ restoredMember }) => {
      expect(restoredMember.member?.id).toBe("newcomer");
      expect(restoredMember.member?.name).toBe("Former Name");
      expect(restoredMember.member?.profile).toBe("former profile");
      expect(restoredMember.withdrawn).toBe(0);
      expect(restoredMember.offer).toStrictEqual({ available: false });
    });
  });

  describe("consent recorded before withdrawal", () => {
    const it = test.extend("restoredConsent", () =>
      runTest(
        Effect.gen(function* restoreConsent() {
          const acceptedAt = DateTime.toDate(DateTime.makeUnsafe("2026-02-01T00:00:00.000Z"));
          yield* addMember({ email: "returning@example.com", userId: "former" });
          yield* query((database) =>
            database.insert(agreementAcceptance).values([
              { acceptedAt, userId: "former", versionId: "agreement-terms-1" },
              { acceptedAt, userId: "former", versionId: "agreement-privacy-1" },
            ]),
          );
          yield* withdrawMember("former", { immediate: false });
          yield* query((database) =>
            database.delete(agreementVersion).where(eq(agreementVersion.id, "agreement-privacy-1")),
          );
          yield* addMember({ email: "returning@example.com", userId: "newcomer" });
          const gone = yield* query((database) =>
            database
              .select({ versionId: agreementAcceptance.versionId })
              .from(agreementAcceptance)
              .where(eq(agreementAcceptance.userId, "former")),
          );
          yield* acceptRecovery("newcomer");
          const restored = yield* query((database) =>
            database
              .select({ versionId: agreementAcceptance.versionId })
              .from(agreementAcceptance)
              .where(eq(agreementAcceptance.userId, "newcomer")),
          );
          return {
            gone: gone.map((row) => row.versionId),
            restored: restored.map((row) => row.versionId).toSorted(),
          };
        }),
      ));

    it("puts the surviving version back on the new member and drops a deleted one", ({
      restoredConsent,
    }) => {
      expect(restoredConsent.gone).toStrictEqual([]);
      expect(restoredConsent.restored).toStrictEqual(["agreement-terms-1"]);
    });
  });
});

describe("declineRecovery", () => {
  describe("within the retention window", () => {
    const it = test.extend("declinedMember", () =>
      runTest(
        Effect.gen(function* declineMember() {
          yield* addMember({ email: "returning@example.com", userId: "former" });
          yield* withdrawMember("former", { immediate: false });
          yield* addMember({ email: "returning@example.com", userId: "newcomer" });
          yield* declineRecovery("newcomer");
          return {
            offer: yield* findRecoveryOffer("newcomer"),
            withdrawn: yield* countWithdrawnMember("former"),
          };
        }),
      ));

    it("stops offering recovery while keeping the snapshot until purge", ({ declinedMember }) => {
      expect(declinedMember.offer).toStrictEqual({ available: false });
      expect(declinedMember.withdrawn).toBe(1);
    });
  });
});

describe("purgeExpiredWithdrawnMembers", () => {
  describe("after the retention window", () => {
    const it = test.extend("purgedMember", () =>
      runTest(
        Effect.gen(function* purgeMember() {
          yield* addUser({ userId: "expired" });
          yield* withdrawMember("expired", { immediate: false });
          yield* query((database) =>
            database
              .update(leaveRequestTable)
              .set({ purgeAt: DateTime.toDate(DateTime.makeUnsafe("2020-01-01T00:00:00.000Z")) })
              .where(eq(leaveRequestTable.memberId, "expired")),
          );
          const purged = yield* purgeExpiredWithdrawnMembers(DateTime.toDate(DateTime.makeUnsafe("2026-01-02T00:00:00.000Z")));
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
    const it = test.extend("sessionCount", () =>
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
