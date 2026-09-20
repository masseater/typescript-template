import { APPLICATION, ROLE } from "@repo/config";
import { count, eq } from "drizzle-orm";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { query } from "./database.ts";
import { withdrawnMember } from "./member-leave-schema.ts";
import {
  acceptRecovery,
  declineRecovery,
  findRecoveryOffer,
  purgeExpiredWithdrawnMembers,
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

const addMember = (added: {
  readonly userId: string;
  readonly email: string;
  readonly name?: string;
  readonly profile?: string;
}): Effect.Effect<void, unknown, unknown> =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      email: added.email,
      emailVerified: true,
      id: added.userId,
      name: added.name ?? added.userId,
      profile: added.profile ?? "",
      role: ROLE.member,
      socialLinks: [],
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  });

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

const getMember = (memberId: string) =>
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
            visibleToOther: yield* getMember("viewer"),
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

describe("findRecoveryOffer", () => {
  describe("a new member with the same verified email as a withdrawn snapshot", () => {
    const it = test.extend("offer", async () =>
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

  describe("a member with a different email", () => {
    const it = test.extend("offer", async () =>
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
    const it = test.extend("offer", async () =>
      runTest(
        Effect.gen(function* loadOffer() {
          yield* addMember({ email: "returning@example.com", userId: "former" });
          yield* withdrawMember("former", { immediate: false });
          yield* query((database) =>
            database
              .update(leaveRequestTable)
              .set({ purgeAt: new Date("2020-01-01T00:00:00.000Z") })
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
    const it = test.extend("offer", async () =>
      runTest(
        Effect.gen(function* loadOffer() {
          yield* addMember({ email: "returning@example.com", userId: "former" });
          yield* withdrawMember("former", { immediate: false });
          yield* query((database) =>
            database
              .update(leaveRequestTable)
              .set({ purgeAt: new Date("2020-01-01T00:00:00.000Z") })
              .where(eq(leaveRequestTable.memberId, "former")),
          );
          yield* purgeExpiredWithdrawnMembers(new Date("2026-01-02T00:00:00.000Z"));
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
    const it = test.extend("restoredMember", async () =>
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
});

describe("declineRecovery", () => {
  describe("within the retention window", () => {
    const it = test.extend("declinedMember", async () =>
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
