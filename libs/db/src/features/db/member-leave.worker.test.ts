import { APPLICATION, PHOTO_SLOT, ROLE } from "@repo/config";
import { eq } from "drizzle-orm";
import { DateTime, Effect, Ref } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { agreementAcceptance, agreementVersion } from "./agreement-schema.ts";
import { TestDatabase } from "./database-test-fixture.ts";
import { query } from "./database.ts";
import { withdrawnMember } from "./member-leave-schema.ts";
import {
  acceptRecovery,
  declineRecovery,
  findRecoveryOffer,
  purgeExpiredWithdrawnMembers,
  withdrawMember,
} from "./member-leave.ts";
import { setPhotoKey } from "./member-profile.ts";
import {
  addOAuthGrant,
  addSession,
  addUser,
  liveSessionCount,
  oauthGrantCounts,
  expireLeave,
  profileFieldsOf,
  withdrawnSnapshotCount,
} from "./records-test-fixture.ts";
import { leaveRequest as leaveRequestTable } from "./schema.ts";
import { findUser, getSessionSecurity } from "./security.ts";

describe("withdrawMember", () => {
  describe("a member who leaves with retention", () => {
    const it = test.extend("revokedAccess", () =>
      Effect.runPromise(
        Effect.gen(function* leaveMember() {
          yield* addUser({ userId: "leaver" });
          yield* addSession({ audience: APPLICATION.user, userId: "leaver" });
          yield* addOAuthGrant("leaver");
          const sessionId = yield* addSession({ audience: APPLICATION.user, userId: "leaver" });
          yield* withdrawMember("leaver", { immediate: false });
          return {
            grants: yield* oauthGrantCounts("leaver"),
            liveSession: yield* getSessionSecurity(sessionId, APPLICATION.user),
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("removes live sessions and OAuth tokens", ({ revokedAccess }) => {
      expect(revokedAccess).toStrictEqual({
        grants: { access: 0, consent: 0, refresh: 0 },
        liveSession: undefined,
      });
    });
  });

  describe("a member who leaves with retention and is looked up again", () => {
    const it = test.extend("directoryPresence", () =>
      Effect.runPromise(
        Effect.gen(function* leaveDirectory() {
          yield* addUser({ userId: "leaver" });
          yield* addSession({ audience: APPLICATION.user, userId: "leaver" });
          yield* addOAuthGrant("leaver");
          yield* addSession({ audience: APPLICATION.user, userId: "leaver" });
          yield* withdrawMember("leaver", { immediate: false });
          return {
            member: yield* findUser("leaver"),
            stillListed: yield* profileFieldsOf("leaver"),
            withdrawn: yield* withdrawnSnapshotCount("leaver"),
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("moves the member out of the active directory", ({ directoryPresence }) => {
      expect(directoryPresence).toStrictEqual({
        member: undefined,
        stillListed: undefined,
        withdrawn: 1,
      });
    });
  });

  describe("a member who leaves with immediate deletion", () => {
    const it = test.extend("deletedMember", () =>
      Effect.runPromise(
        Effect.gen(function* deleteMember() {
          yield* addUser({ userId: "gone" });
          yield* withdrawMember("gone", { immediate: true });
          return {
            member: yield* findUser("gone"),
            withdrawn: yield* withdrawnSnapshotCount("gone"),
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("does not keep a withdrawn snapshot", ({ deletedMember }) => {
      expect(deletedMember).toStrictEqual({ member: undefined, withdrawn: 0 });
    });
  });
});

describe("findRecoveryOffer", () => {
  describe("a new member with the same verified email as a withdrawn snapshot", () => {
    const it = test.extend("offer", () =>
      Effect.runPromise(
        Effect.gen(function* loadOffer() {
          yield* addUser({
            email: "returning@example.com",
            name: "Former Name",
            profile: "former profile",
            userId: "former",
          });
          yield* withdrawMember("former", { immediate: false });
          yield* addUser({ email: "returning@example.com", userId: "newcomer" });
          return yield* findRecoveryOffer("newcomer");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("shows the recovery offer", ({ offer }) => {
      expect(offer).toStrictEqual({ available: true, previousName: "Former Name" });
    });
  });

  describe("two withdrawn snapshots for the same email", () => {
    const it = test.extend("offer", () =>
      Effect.runPromise(
        Effect.gen(function* loadOffer() {
          yield* addUser({
            email: "returning@example.com",
            name: "Older Name",
            userId: "older",
          });
          yield* withdrawMember("older", { immediate: false });
          yield* addUser({
            email: "returning@example.com",
            name: "Newer Name",
            userId: "newer",
          });
          yield* withdrawMember("newer", { immediate: false });
          yield* query((database) =>
            database
              .update(withdrawnMember)
              .set({
                withdrawnAt: DateTime.toDate(DateTime.makeUnsafe("2020-01-01T00:00:00.000Z")),
              })
              .where(eq(withdrawnMember.memberId, "older")),
          );
          yield* addUser({ email: "returning@example.com", userId: "newcomer" });
          return yield* findRecoveryOffer("newcomer");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("offers the latest snapshot", ({ offer }) => {
      expect(offer).toStrictEqual({ available: true, previousName: "Newer Name" });
    });
  });

  describe("a member with a different email", () => {
    const it = test.extend("offer", () =>
      Effect.runPromise(
        Effect.gen(function* loadOffer() {
          yield* addUser({ email: "former@example.com", userId: "former" });
          yield* withdrawMember("former", { immediate: false });
          yield* addUser({ email: "other@example.com", userId: "other" });
          return yield* findRecoveryOffer("other");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("shows no offer", ({ offer }) => {
      expect(offer).toStrictEqual({ available: false });
    });
  });

  describe("an expired withdrawn snapshot", () => {
    const it = test.extend("offer", () =>
      Effect.runPromise(
        Effect.gen(function* loadOffer() {
          yield* addUser({ email: "returning@example.com", userId: "former" });
          yield* withdrawMember("former", { immediate: false });
          yield* query((database) =>
            database
              .update(leaveRequestTable)
              .set({ purgeAt: DateTime.toDate(DateTime.makeUnsafe("2020-01-01T00:00:00.000Z")) })
              .where(eq(leaveRequestTable.memberId, "former")),
          );
          yield* addUser({ email: "returning@example.com", userId: "newcomer" });
          return yield* findRecoveryOffer("newcomer");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("shows no offer", ({ offer }) => {
      expect(offer).toStrictEqual({ available: false });
    });
  });

  describe("a purged withdrawn snapshot", () => {
    const it = test.extend("offer", () =>
      Effect.runPromise(
        Effect.gen(function* loadOffer() {
          yield* addUser({ email: "returning@example.com", userId: "former" });
          yield* withdrawMember("former", { immediate: false });
          yield* query((database) =>
            database
              .update(leaveRequestTable)
              .set({ purgeAt: DateTime.toDate(DateTime.makeUnsafe("2020-01-01T00:00:00.000Z")) })
              .where(eq(leaveRequestTable.memberId, "former")),
          );
          yield* purgeExpiredWithdrawnMembers(
            DateTime.toDate(DateTime.makeUnsafe("2026-01-02T00:00:00.000Z")),
            () => Effect.void,
          );
          yield* addUser({ email: "returning@example.com", userId: "newcomer" });
          return yield* findRecoveryOffer("newcomer");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("shows no offer", ({ offer }) => {
      expect(offer).toStrictEqual({ available: false });
    });
  });
});

describe("acceptRecovery", () => {
  describe("within the retention window", () => {
    const it = test.extend("restoredMember", () =>
      Effect.runPromise(
        Effect.gen(function* restoreMember() {
          yield* addUser({
            email: "returning@example.com",
            name: "Former Name",
            profile: "former profile",
            userId: "former",
          });
          yield* withdrawMember("former", { immediate: false });
          yield* addUser({ email: "returning@example.com", userId: "newcomer" });
          yield* acceptRecovery("newcomer");
          return {
            offer: yield* findRecoveryOffer("newcomer"),
            profile: yield* profileFieldsOf("newcomer"),
            withdrawn: yield* withdrawnSnapshotCount("former"),
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("restores the profile onto the new member id", ({ restoredMember }) => {
      expect(restoredMember).toStrictEqual({
        offer: { available: false },
        profile: { id: "newcomer", name: "Former Name", profile: "former profile" },
        withdrawn: 0,
      });
    });
  });

  describe("consent recorded before withdrawal", () => {
    const it = test.extend("restoredConsent", () =>
      Effect.runPromise(
        Effect.gen(function* restoreConsent() {
          const acceptedAt = DateTime.toDate(DateTime.makeUnsafe("2026-02-01T00:00:00.000Z"));
          yield* addUser({ email: "returning@example.com", userId: "former" });
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
          yield* addUser({ email: "returning@example.com", userId: "newcomer" });
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
            gone: gone.map((acceptance) => acceptance.versionId),
            restored: restored.map((acceptance) => acceptance.versionId).toSorted(),
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("puts the surviving version back on the new member and drops a deleted one", ({
      restoredConsent,
    }) => {
      expect(restoredConsent).toStrictEqual({ gone: [], restored: ["agreement-terms-1"] });
    });
  });
});

describe("declineRecovery", () => {
  describe("within the retention window", () => {
    const it = test.extend("declinedMember", () =>
      Effect.runPromise(
        Effect.gen(function* declineMember() {
          yield* addUser({ email: "returning@example.com", userId: "former" });
          yield* withdrawMember("former", { immediate: false });
          yield* addUser({ email: "returning@example.com", userId: "newcomer" });
          yield* declineRecovery("newcomer");
          return {
            offer: yield* findRecoveryOffer("newcomer"),
            withdrawn: yield* withdrawnSnapshotCount("former"),
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("stops offering recovery while keeping the snapshot until purge", ({ declinedMember }) => {
      expect(declinedMember).toStrictEqual({ offer: { available: false }, withdrawn: 1 });
    });
  });
});

describe("purgeExpiredWithdrawnMembers", () => {
  const checkedAt = DateTime.toDate(DateTime.makeUnsafe("2026-01-02T00:00:00.000Z"));

  describe("after the retention window", () => {
    const it = test.extend("purgedMember", () =>
      Effect.runPromise(
        Effect.gen(function* purgeMember() {
          yield* addUser({ userId: "expired" });
          yield* setPhotoKey({
            memberId: "expired",
            photoKey: "photos/expired/face/1",
            slot: PHOTO_SLOT.face,
          });
          yield* withdrawMember("expired", { immediate: false });
          yield* expireLeave("expired");
          const released = yield* Ref.make<
            readonly { readonly photoKeys: readonly string[]; readonly snapshots: number }[]
          >([]);
          const purged = yield* purgeExpiredWithdrawnMembers(checkedAt, (photoKeys) =>
            withdrawnSnapshotCount("expired").pipe(
              Effect.flatMap((snapshots) =>
                Ref.update(released, (earlier) => [...earlier, { photoKeys, snapshots }]),
              ),
            ),
          );
          return {
            purged,
            released: yield* Ref.get(released),
            withdrawn: yield* withdrawnSnapshotCount("expired"),
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("releases the kept photo keys before removing the withdrawn snapshot", ({
      purgedMember,
    }) => {
      expect(purgedMember).toStrictEqual({
        purged: { memberIds: ["expired"], retainedMemberIds: [] },
        released: [{ photoKeys: ["photos/expired/face/1"], snapshots: 1 }],
        withdrawn: 0,
      });
    });
  });

  describe("when the photos cannot be released", () => {
    const it = test.extend("retainedMember", () =>
      Effect.runPromise(
        Effect.gen(function* retainMember() {
          yield* addUser({ userId: "stuck" });
          yield* setPhotoKey({
            memberId: "stuck",
            photoKey: "photos/stuck/company/1",
            slot: PHOTO_SLOT.company,
          });
          yield* withdrawMember("stuck", { immediate: false });
          yield* expireLeave("stuck");
          const purged = yield* purgeExpiredWithdrawnMembers(checkedAt, () =>
            Effect.fail("storage unavailable"),
          );
          return { purged, withdrawn: yield* withdrawnSnapshotCount("stuck") };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("keeps the withdrawn snapshot for the next purge", ({ retainedMember }) => {
      expect(retainedMember).toStrictEqual({
        purged: { memberIds: [], retainedMemberIds: ["stuck"] },
        withdrawn: 1,
      });
    });
  });
});

describe("liveSessionCount", () => {
  describe("a member whose sessions were revoked on leave", () => {
    const it = test.extend("sessionCount", () =>
      Effect.runPromise(
        Effect.gen(function* countSessions() {
          yield* addUser({ role: ROLE.member, userId: "leaver" });
          yield* addSession({ audience: APPLICATION.user, userId: "leaver" });
          yield* withdrawMember("leaver", { immediate: false });
          return yield* liveSessionCount("leaver");
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("reports zero live sessions", ({ sessionCount }) => {
      expect(sessionCount).toBe(0);
    });
  });
});
