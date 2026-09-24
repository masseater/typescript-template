import { ADMIN_PERMISSION, APPLICATION, ROLE, STAFF_PERMISSION } from "@repo/config";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { inviteAdmin } from "./admin.ts";
import { TestDatabase } from "./database-test-fixture.ts";
import { acceptInvite, issueInvite, previewInvite } from "./invite.ts";
import { addSession, addUser, auditActionsOf } from "./records-test-fixture.ts";
import { findUser } from "./security.ts";
import { inviteStaff } from "./staff.ts";

const ownerSession = Effect.fn("ownerSession")(function* ownerSession() {
  yield* addUser({ role: ROLE.administrator, userId: "owner" });
  return yield* addSession({ audience: APPLICATION.admin, userId: "owner" });
});

const accepted = { name: "Invited", passwordHash: "hashed", rawToken: "" } as const;

describe("an admin invite", () => {
  describe("accepted once", () => {
    const it = test.extend("acceptedAdmin", () =>
      Effect.runPromise(
        Effect.gen(function* acceptOnce() {
          const sessionId = yield* ownerSession();
          const invite = yield* inviteAdmin({
            email: "New.Admin@Example.com",
            permission: ADMIN_PERMISSION.operator,
            sessionId,
          });
          const preview = yield* previewInvite(invite.token, APPLICATION.admin);
          const createdAdmin = yield* acceptInvite({
            ...accepted,
            audience: APPLICATION.admin,
            rawToken: invite.token,
          });
          const reused = yield* Effect.flip(
            acceptInvite({ ...accepted, audience: APPLICATION.admin, rawToken: invite.token }),
          );
          const previewAfter = yield* previewInvite(invite.token, APPLICATION.admin);
          const createdUser = yield* findUser(createdAdmin.userId);
          const auditTrail = yield* auditActionsOf(invite.id);
          return {
            audit: auditTrail.map((auditEntry) => [auditEntry.action, auditEntry.actorKind]),
            created: {
              email: createdAdmin.email,
              permission: createdAdmin.permission,
              role: createdAdmin.role,
            },
            preview:
              preview === undefined
                ? undefined
                : { email: preview.email, permission: preview.permission },
            previewAfter,
            reused: reused._tag,
            user:
              createdUser === undefined
                ? undefined
                : {
                    accountState: createdUser.accountState,
                    emailVerified: createdUser.emailVerified,
                    permission: createdUser.permission,
                    role: createdUser.role,
                  },
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("creates the administrator with the invited level and burns the token", ({
      acceptedAdmin,
    }) => {
      expect(acceptedAdmin).toStrictEqual({
        audit: [
          ["admin_invited", ROLE.administrator],
          ["invite_accepted", ROLE.administrator],
        ],
        created: {
          email: "new.admin@example.com",
          permission: ADMIN_PERMISSION.operator,
          role: ROLE.administrator,
        },
        preview: { email: "new.admin@example.com", permission: ADMIN_PERMISSION.operator },
        previewAfter: undefined,
        reused: "InviteRejected",
        user: {
          accountState: "active",
          emailVerified: true,
          permission: ADMIN_PERMISSION.operator,
          role: ROLE.administrator,
        },
      });
    });
  });

  describe("accepted on the wrong application", () => {
    const it = test.extend("rejectionTag", () =>
      Effect.runPromise(
        Effect.gen(function* wrongAudience() {
          const sessionId = yield* ownerSession();
          const invite = yield* inviteAdmin({
            email: "new@example.com",
            permission: ADMIN_PERMISSION.viewer,
            sessionId,
          });
          const rejected = yield* acceptInvite({
            ...accepted,
            audience: APPLICATION.dashboard,
            rawToken: invite.token,
          }).pipe(Effect.flip);
          return rejected._tag;
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is rejected", ({ rejectionTag }) => {
      expect(rejectionTag).toBe("InviteRejected");
    });
  });

  describe("for a registered email", () => {
    const it = test.extend("rejectionTag", () =>
      Effect.runPromise(
        Effect.gen(function* registered() {
          yield* addUser({ userId: "member" });
          const sessionId = yield* ownerSession();
          const rejected = yield* inviteAdmin({
            email: "member@example.com",
            permission: ADMIN_PERMISSION.viewer,
            sessionId,
          }).pipe(Effect.flip);
          return rejected._tag;
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is refused", ({ rejectionTag }) => {
      expect(rejectionTag).toBe("InviteRejected");
    });
  });

  describe("issued twice for the same email", () => {
    const it = test.extend("rejectionTag", () =>
      Effect.runPromise(
        Effect.gen(function* pending() {
          const sessionId = yield* ownerSession();
          yield* inviteAdmin({
            email: "new@example.com",
            permission: ADMIN_PERMISSION.viewer,
            sessionId,
          });
          const rejected = yield* inviteAdmin({
            email: "new@example.com",
            permission: ADMIN_PERMISSION.viewer,
            sessionId,
          }).pipe(Effect.flip);
          return rejected._tag;
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("keeps the pending invite", ({ rejectionTag }) => {
      expect(rejectionTag).toBe("InviteRejected");
    });
  });

  describe("with an unknown token", () => {
    const it = test.extend("rejectionTag", () =>
      Effect.runPromise(
        Effect.gen(function* unknownToken() {
          const rejected = yield* acceptInvite({
            ...accepted,
            audience: APPLICATION.admin,
            rawToken: "unknown",
          }).pipe(Effect.flip);
          return rejected._tag;
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is rejected", ({ rejectionTag }) => {
      expect(rejectionTag).toBe("InviteRejected");
    });
  });

  describe("that expired", () => {
    const it = test.extend("preview", () =>
      Effect.runPromise(
        Effect.gen(function* expired() {
          const invite = yield* issueInvite({
            audience: APPLICATION.admin,
            audit: { action: "admin_invited", actorId: "owner", actorKind: ROLE.administrator },
            email: "new@example.com",
            lifetimeMilliseconds: -1,
            permission: ADMIN_PERMISSION.viewer,
          });
          return yield* previewInvite(invite.token, APPLICATION.admin);
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("is no longer open", ({ preview }) => {
      expect(preview).toBe(undefined);
    });
  });
});

describe("a staff invite", () => {
  describe("accepted", () => {
    const it = test.extend("acceptedStaff", () =>
      Effect.runPromise(
        Effect.gen(function* acceptStaff() {
          yield* addUser({ role: ROLE.staff, userId: "editor" });
          const sessionId = yield* addSession({
            audience: APPLICATION.dashboard,
            userId: "editor",
          });
          const invite = yield* inviteStaff({
            email: "staff@example.com",
            permission: STAFF_PERMISSION.viewer,
            sessionId,
          });
          const createdStaff = yield* acceptInvite({
            ...accepted,
            audience: APPLICATION.dashboard,
            rawToken: invite.token,
          });
          const auditTrail = yield* auditActionsOf(invite.id);
          return {
            acceptedAction: auditTrail[1]?.action,
            created: { permission: createdStaff.permission, role: createdStaff.role },
            invitedAudit: auditTrail
              .slice(0, 1)
              .map((auditEntry) => [auditEntry.action, auditEntry.actorId, auditEntry.actorKind]),
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("creates a staff account with the invited level", ({ acceptedStaff }) => {
      expect(acceptedStaff).toStrictEqual({
        acceptedAction: "invite_accepted",
        created: {
          permission: STAFF_PERMISSION.viewer,
          role: ROLE.staff,
        },
        invitedAudit: [["staff_invited", "editor", ROLE.staff]],
      });
    });
  });
});
