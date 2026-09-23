import { ACCOUNT_STATE, ADMIN_PERMISSION, APPLICATION, ROLE } from "@repo/config";
import { Effect, Exit, type Layer } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  deleteUser,
  inviteAdmin,
  listAdmins,
  listUsers,
  setAdminPermission,
  setAdminState,
  setMemberState,
} from "./admin.ts";
import { addSession, addUser, auditActionsOf } from "./records-fixture.ts";
import { getSessionSecurity } from "./security.ts";
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

const page = { limit: 10, offset: 0 } as const;

const signInAs = Effect.fn("signInAs")(function* signInAs(
  permission: (typeof ADMIN_PERMISSION)[keyof typeof ADMIN_PERMISSION],
) {
  yield* addUser({ permission, role: ROLE.administrator, userId: `actor-${permission}` });
  return yield* addSession({ audience: APPLICATION.admin, userId: `actor-${permission}` });
});

describe("admin permission levels", () => {
  describe("a viewer", () => {
    const it = test.extend("outcome", () =>
      runTest(
        Effect.gen(function* viewerActs() {
          yield* addUser({ userId: "member" });
          yield* addUser({ role: ROLE.administrator, userId: "owner" });
          const sessionId = yield* signInAs(ADMIN_PERMISSION.viewer);
          const listed = yield* listUsers(sessionId, page);
          const suspend = yield* Effect.exit(
            setMemberState({
              accountState: ACCOUNT_STATE.suspended,
              memberId: "member",
              sessionId,
            }),
          );
          const remove = yield* Effect.exit(deleteUser(sessionId, "member"));
          const admins = yield* Effect.exit(listAdmins(sessionId));
          const invite = yield* Effect.exit(
            inviteAdmin({
              email: "new@example.com",
              permission: ADMIN_PERMISSION.viewer,
              sessionId,
            }),
          );
          const promote = yield* Effect.exit(
            setAdminPermission({
              adminId: "owner",
              permission: ADMIN_PERMISSION.viewer,
              sessionId,
            }),
          );
          return {
            admins: Exit.isFailure(admins),
            invite: Exit.isFailure(invite),
            listed: listed.users.map((listedUser) => listedUser.id),
            promote: Exit.isFailure(promote),
            remove: Exit.isFailure(remove),
            suspend: Exit.isFailure(suspend),
          };
        }),
      ));

    it("reads members but cannot operate on anyone", ({ outcome }) => {
      expect(outcome).toStrictEqual({
        admins: true,
        invite: true,
        listed: ["member"],
        promote: true,
        remove: true,
        suspend: true,
      });
    });
  });

  describe("a viewer suspending a member", () => {
    const it = test.extend("tag", () =>
      failureTag(
        Effect.gen(function* viewerSuspends() {
          yield* addUser({ userId: "member" });
          const sessionId = yield* signInAs(ADMIN_PERMISSION.viewer);
          return yield* setMemberState({
            accountState: ACCOUNT_STATE.suspended,
            memberId: "member",
            sessionId,
          });
        }),
      ));

    it("is rejected with the missing level", ({ tag }) => {
      expect(tag).toBe("PermissionRequired");
    });
  });

  describe("an operator", () => {
    const it = test.extend("outcome", () =>
      runTest(
        Effect.gen(function* operatorActs() {
          yield* addUser({ userId: "member" });
          yield* addUser({ role: ROLE.administrator, userId: "owner" });
          const sessionId = yield* signInAs(ADMIN_PERMISSION.operator);
          const suspended = yield* setMemberState({
            accountState: ACCOUNT_STATE.suspended,
            memberId: "member",
            sessionId,
          });
          const admins = yield* Effect.exit(listAdmins(sessionId));
          const invite = yield* Effect.exit(
            inviteAdmin({
              email: "new@example.com",
              permission: ADMIN_PERMISSION.viewer,
              sessionId,
            }),
          );
          const promote = yield* Effect.exit(
            setAdminPermission({
              adminId: "owner",
              permission: ADMIN_PERMISSION.viewer,
              sessionId,
            }),
          );
          const disable = yield* Effect.exit(
            setAdminState({ accountState: ACCOUNT_STATE.suspended, adminId: "owner", sessionId }),
          );
          return {
            admins: Exit.isFailure(admins),
            disable: Exit.isFailure(disable),
            invite: Exit.isFailure(invite),
            promote: Exit.isFailure(promote),
            suspended,
          };
        }),
      ));

    it("operates on members but cannot manage administrators", ({ outcome }) => {
      expect(outcome).toStrictEqual({
        admins: true,
        disable: true,
        invite: true,
        promote: true,
        suspended: { accountState: ACCOUNT_STATE.suspended, id: "member" },
      });
    });
  });

  describe("an owner", () => {
    const it = test.extend("outcome", () =>
      runTest(
        Effect.gen(function* ownerActs() {
          yield* addUser({
            permission: ADMIN_PERMISSION.viewer,
            role: ROLE.administrator,
            userId: "other",
          });
          const sessionId = yield* signInAs(ADMIN_PERMISSION.owner);
          const promoted = yield* setAdminPermission({
            adminId: "other",
            permission: ADMIN_PERMISSION.operator,
            sessionId,
          });
          const disabled = yield* setAdminState({
            accountState: ACCOUNT_STATE.suspended,
            adminId: "other",
            sessionId,
          });
          const admins = yield* listAdmins(sessionId);
          const audit = yield* auditActionsOf("other");
          return {
            admins: admins.map((admin) => [admin.id, admin.permission, admin.accountState]),
            audit: audit.map((event) => event.action),
            disabled,
            promoted,
          };
        }),
      ));

    it("manages administrators and every change is audited", ({ outcome }) => {
      expect(outcome).toStrictEqual({
        admins: [
          ["actor-owner", ADMIN_PERMISSION.owner, ACCOUNT_STATE.active],
          ["other", ADMIN_PERMISSION.operator, ACCOUNT_STATE.suspended],
        ],
        audit: ["admin_permission_changed", "admin_disabled"],
        disabled: { accountState: ACCOUNT_STATE.suspended, id: "other" },
        promoted: { id: "other", permission: ADMIN_PERMISSION.operator },
      });
    });
  });

  describe("an owner disabling themselves", () => {
    const it = test.extend("tag", () =>
      failureTag(
        Effect.gen(function* selfDisable() {
          const sessionId = yield* signInAs(ADMIN_PERMISSION.owner);
          return yield* setAdminState({
            accountState: ACCOUNT_STATE.suspended,
            adminId: "actor-owner",
            sessionId,
          });
        }),
      ));

    it("is refused", ({ tag }) => {
      expect(tag).toBe("TargetUnavailable");
    });
  });

  describe("the last owner demoting themselves", () => {
    const it = test.extend("tag", () =>
      failureTag(
        Effect.gen(function* lastOwner() {
          const sessionId = yield* signInAs(ADMIN_PERMISSION.owner);
          return yield* setAdminPermission({
            adminId: "actor-owner",
            permission: ADMIN_PERMISSION.operator,
            sessionId,
          });
        }),
      ));

    it("is refused to keep one owner", ({ tag }) => {
      expect(tag).toBe("LastAdminRequired");
    });
  });

  describe("a member session", () => {
    const it = test.extend("tag", () =>
      failureTag(
        Effect.gen(function* memberActs() {
          yield* addUser({ userId: "member" });
          const sessionId = yield* addSession({ audience: APPLICATION.admin, userId: "member" });
          return yield* listUsers(sessionId, page);
        }),
      ));

    it("cannot use the admin module", ({ tag }) => {
      expect(tag).toBe("AdminStrongSessionRequired");
    });
  });
});

describe("member suspension", () => {
  describe("a suspended member", () => {
    const it = test.extend("outcome", () =>
      runTest(
        Effect.gen(function* suspendMember() {
          yield* addUser({ userId: "member" });
          const memberSession = yield* addSession({ audience: APPLICATION.user, userId: "member" });
          const sessionId = yield* signInAs(ADMIN_PERMISSION.operator);
          yield* setMemberState({
            accountState: ACCOUNT_STATE.suspended,
            memberId: "member",
            sessionId,
          });
          const session = yield* getSessionSecurity(memberSession, APPLICATION.user);
          const listed = yield* listUsers(sessionId, {
            ...page,
            accountState: ACCOUNT_STATE.suspended,
          });
          const restored = yield* setMemberState({
            accountState: ACCOUNT_STATE.active,
            memberId: "member",
            sessionId,
          });
          const audit = yield* auditActionsOf("member");
          return {
            audit: audit.map((event) => [
              event.action,
              event.actorId,
              event.actorKind,
              event.channel,
            ]),
            listed: listed.users.map((listedUser) => [listedUser.id, listedUser.accountState]),
            restored,
            session,
          };
        }),
      ));

    it("loses live sessions, stays listed for admins and can be restored", ({ outcome }) => {
      expect(outcome).toStrictEqual({
        audit: [
          ["member_suspended", "actor-operator", ROLE.administrator, "ui"],
          ["member_unsuspended", "actor-operator", ROLE.administrator, "ui"],
        ],
        listed: [["member", ACCOUNT_STATE.suspended]],
        restored: { accountState: ACCOUNT_STATE.active, id: "member" },
        session: undefined,
      });
    });
  });

  describe("suspending an administrator through the member operation", () => {
    const it = test.extend("tag", () =>
      failureTag(
        Effect.gen(function* suspendAdmin() {
          yield* addUser({ role: ROLE.administrator, userId: "other" });
          const sessionId = yield* signInAs(ADMIN_PERMISSION.operator);
          return yield* setMemberState({
            accountState: ACCOUNT_STATE.suspended,
            memberId: "other",
            sessionId,
          });
        }),
      ));

    it("does not touch the administrator", ({ tag }) => {
      expect(tag).toBe("TargetUnavailable");
    });
  });
});
