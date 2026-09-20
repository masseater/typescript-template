import { ADMIN_PERMISSION, APPLICATION, ROLE, STAFF_PERMISSION } from "@repo/config";
import { Effect, type Layer } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { inviteAdmin } from "./admin.ts";
import { acceptInvite, issueInvite, previewInvite } from "./invite.ts";
import { addSession, addUser, auditActionsOf } from "./records-fixture.ts";
import { findUser } from "./security.ts";
import { inviteStaff } from "./staff.ts";
import { TestDatabase } from "./testing.ts";

const runTest = <Value>(
  program: Effect.Effect<Value, unknown, Layer.Success<typeof TestDatabase>>,
): Promise<Value> => Effect.runPromise(program.pipe(Effect.provide(TestDatabase)));

const failureTag = <Value>(
  program: Effect.Effect<Value, { readonly _tag: string }, Layer.Success<typeof TestDatabase>>,
): Promise<string> =>
  runTest(
    program.pipe(
      Effect.flip,
      Effect.map((failure) => failure._tag),
    ),
  );

const ownerSession = Effect.fn("ownerSession")(function* ownerSession() {
  yield* addUser({ role: ROLE.administrator, userId: "owner" });
  return yield* addSession({ audience: APPLICATION.admin, userId: "owner" });
});

const accepted = { name: "Invited", passwordHash: "hashed", rawToken: "" } as const;

describe("an admin invite", () => {
  describe("accepted once", () => {
    const it = test.extend("outcome", async () =>
      runTest(
        Effect.gen(function* acceptOnce() {
          const sessionId = yield* ownerSession();
          const invite = yield* inviteAdmin({
            email: "New.Admin@Example.com",
            permission: ADMIN_PERMISSION.operator,
            sessionId,
          });
          const preview = yield* previewInvite(invite.token, APPLICATION.admin);
          const created = yield* acceptInvite({
            ...accepted,
            audience: APPLICATION.admin,
            rawToken: invite.token,
          });
          const reused = yield* Effect.flip(
            acceptInvite({ ...accepted, audience: APPLICATION.admin, rawToken: invite.token }),
          );
          const previewAfter = yield* previewInvite(invite.token, APPLICATION.admin);
          const createdUser = yield* findUser(created.userId);
          const audit = yield* auditActionsOf(invite.id);
          return {
            audit: audit.map((event) => [event.action, event.actorKind]),
            created: { email: created.email, permission: created.permission, role: created.role },
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
        }),
      ));

    it("creates the administrator with the invited level and burns the token", ({ outcome }) => {
      expect(outcome).toStrictEqual({
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
    const it = test.extend("tag", async () =>
      failureTag(
        Effect.gen(function* wrongAudience() {
          const sessionId = yield* ownerSession();
          const invite = yield* inviteAdmin({
            email: "new@example.com",
            permission: ADMIN_PERMISSION.viewer,
            sessionId,
          });
          return yield* acceptInvite({
            ...accepted,
            audience: APPLICATION.wiki,
            rawToken: invite.token,
          });
        }),
      ));

    it("is rejected", ({ tag }) => {
      expect(tag).toBe("InviteRejected");
    });
  });

  describe("for a registered email", () => {
    const it = test.extend("tag", async () =>
      failureTag(
        Effect.gen(function* registered() {
          yield* addUser({ userId: "member" });
          const sessionId = yield* ownerSession();
          return yield* inviteAdmin({
            email: "member@example.com",
            permission: ADMIN_PERMISSION.viewer,
            sessionId,
          });
        }),
      ));

    it("is refused", ({ tag }) => {
      expect(tag).toBe("InviteRejected");
    });
  });

  describe("issued twice for the same email", () => {
    const it = test.extend("tag", async () =>
      failureTag(
        Effect.gen(function* pending() {
          const sessionId = yield* ownerSession();
          yield* inviteAdmin({
            email: "new@example.com",
            permission: ADMIN_PERMISSION.viewer,
            sessionId,
          });
          return yield* inviteAdmin({
            email: "new@example.com",
            permission: ADMIN_PERMISSION.viewer,
            sessionId,
          });
        }),
      ));

    it("keeps the pending invite", ({ tag }) => {
      expect(tag).toBe("InviteRejected");
    });
  });

  describe("with an unknown token", () => {
    const it = test.extend("tag", async () =>
      failureTag(acceptInvite({ ...accepted, audience: APPLICATION.admin, rawToken: "unknown" })));

    it("is rejected", ({ tag }) => {
      expect(tag).toBe("InviteRejected");
    });
  });

  describe("that expired", () => {
    const it = test.extend("preview", async () =>
      runTest(
        Effect.gen(function* expired() {
          const invite = yield* issueInvite({
            audience: APPLICATION.admin,
            audit: { action: "admin_invited", actorId: "owner", actorKind: ROLE.administrator },
            email: "new@example.com",
            lifetimeMilliseconds: -1,
            permission: ADMIN_PERMISSION.viewer,
          });
          return yield* previewInvite(invite.token, APPLICATION.admin);
        }),
      ));

    it("is no longer open", ({ preview }) => {
      expect(preview).toBeUndefined();
    });
  });
});

describe("a staff invite", () => {
  describe("accepted", () => {
    const it = test.extend("outcome", async () =>
      runTest(
        Effect.gen(function* acceptStaff() {
          yield* addUser({ role: ROLE.staff, userId: "editor" });
          const sessionId = yield* addSession({ audience: APPLICATION.wiki, userId: "editor" });
          const invite = yield* inviteStaff({
            email: "staff@example.com",
            permission: STAFF_PERMISSION.viewer,
            sessionId,
          });
          const created = yield* acceptInvite({
            ...accepted,
            audience: APPLICATION.wiki,
            rawToken: invite.token,
          });
          const audit = yield* auditActionsOf(invite.id);
          return {
            audit: audit.map((event) => [event.action, event.actorId, event.actorKind]),
            created: { permission: created.permission, role: created.role },
          };
        }),
      ));

    it("creates a staff account with the invited level", ({ outcome }) => {
      expect(outcome.created).toStrictEqual({
        permission: STAFF_PERMISSION.viewer,
        role: ROLE.staff,
      });
      expect(outcome.audit[0]).toStrictEqual(["staff_invited", "editor", ROLE.staff]);
      expect(outcome.audit[1]?.[0]).toBe("invite_accepted");
    });
  });
});
