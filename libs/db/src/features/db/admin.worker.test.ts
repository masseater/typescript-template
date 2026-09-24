import { ACCOUNT_STATE, ADMIN_PERMISSION, APPLICATION, ROLE } from "@repo/config";
import { DateTime, Effect, Exit, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  deleteUser,
  getMember,
  inviteAdmin,
  listAdmins,
  listAgreementVersions,
  listUsers,
  readAgreementVersion,
  setAdminPermission,
  setAdminState,
  setMemberState,
} from "./admin.ts";
import { dashboardStaff } from "./dashboard-staff.ts";
import { TestDatabase } from "./database-test-fixture.ts";
import { query } from "./database.ts";
import { startInterview } from "./interview.ts";
import { CONVERSATION_KIND } from "./messaging-schema.ts";
import { addSession, addUser, auditActionsOf } from "./records-test-fixture.ts";
import { conversation, conversationParticipant, directMessage } from "./schema.ts";
import { getSessionSecurity } from "./security.ts";

const page = { limit: 10, offset: 0 } as const;

const signInAs = Effect.fn("signInAs")(function* signInAs(
  permission: (typeof ADMIN_PERMISSION)[keyof typeof ADMIN_PERMISSION],
) {
  yield* addUser({ permission, role: ROLE.administrator, userId: `actor-${permission}` });
  return yield* addSession({ audience: APPLICATION.admin, userId: `actor-${permission}` });
});

describe("admin permission levels", () => {
  describe("a viewer", () => {
    const it = test.extend("viewerReach", () =>
      Effect.runPromise(
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
          const remove = yield* Effect.exit(deleteUser({ sessionId, targetId: "member" }));
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
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("reads members but cannot operate on anyone", ({ viewerReach }) => {
      expect(viewerReach).toStrictEqual({
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
      Effect.runPromise(
        Effect.gen(function* viewerSuspends() {
          yield* addUser({ userId: "member" });
          const sessionId = yield* signInAs(ADMIN_PERMISSION.viewer);
          return yield* setMemberState({
            accountState: ACCOUNT_STATE.suspended,
            memberId: "member",
            sessionId,
          });
        }).pipe(
          Effect.flip,
          Effect.map((failure) => failure._tag),
          Effect.provide(TestDatabase),
        ),
      ));

    it("is rejected with the missing level", ({ tag }) => {
      expect(tag).toBe("PermissionRequired");
    });
  });

  describe("an operator", () => {
    const it = test.extend("operatorReach", () =>
      Effect.runPromise(
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
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("operates on members but cannot manage administrators", ({ operatorReach }) => {
      expect(operatorReach).toStrictEqual({
        admins: true,
        disable: true,
        invite: true,
        promote: true,
        suspended: { accountState: ACCOUNT_STATE.suspended, id: "member" },
      });
    });
  });

  describe("an owner", () => {
    const it = test.extend("ownerChanges", () =>
      Effect.runPromise(
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
            audit: audit.map((auditEntry) => auditEntry.action),
            disabled,
            promoted,
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("manages administrators and every change is audited", ({ ownerChanges }) => {
      expect(ownerChanges).toStrictEqual({
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
      Effect.runPromise(
        Effect.gen(function* selfDisable() {
          const sessionId = yield* signInAs(ADMIN_PERMISSION.owner);
          return yield* setAdminState({
            accountState: ACCOUNT_STATE.suspended,
            adminId: "actor-owner",
            sessionId,
          });
        }).pipe(
          Effect.flip,
          Effect.map((failure) => failure._tag),
          Effect.provide(TestDatabase),
        ),
      ));

    it("is refused", ({ tag }) => {
      expect(tag).toBe("TargetUnavailable");
    });
  });

  describe("the last owner demoting themselves", () => {
    const it = test.extend("tag", () =>
      Effect.runPromise(
        Effect.gen(function* lastOwner() {
          const sessionId = yield* signInAs(ADMIN_PERMISSION.owner);
          return yield* setAdminPermission({
            adminId: "actor-owner",
            permission: ADMIN_PERMISSION.operator,
            sessionId,
          });
        }).pipe(
          Effect.flip,
          Effect.map((failure) => failure._tag),
          Effect.provide(TestDatabase),
        ),
      ));

    it("is refused to keep one owner", ({ tag }) => {
      expect(tag).toBe("LastAdminRequired");
    });
  });

  describe("a member session", () => {
    const it = test.extend("tag", () =>
      Effect.runPromise(
        Effect.gen(function* memberActs() {
          yield* addUser({ userId: "member" });
          const sessionId = yield* addSession({ audience: APPLICATION.admin, userId: "member" });
          return yield* listUsers(sessionId, page);
        }).pipe(
          Effect.flip,
          Effect.map((failure) => failure._tag),
          Effect.provide(TestDatabase),
        ),
      ));

    it("cannot use the admin module", ({ tag }) => {
      expect(tag).toBe("AdminStrongSessionRequired");
    });
  });
});

describe("member suspension", () => {
  describe("a suspended member", () => {
    const it = test.extend("suspensionTrail", () =>
      Effect.runPromise(
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
            audit: audit.map((auditEntry) => [
              auditEntry.action,
              auditEntry.actorId,
              auditEntry.actorKind,
              auditEntry.channel,
            ]),
            listed: listed.users.map((listedUser) => [listedUser.id, listedUser.accountState]),
            restored,
            session,
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("loses live sessions, stays listed for admins and can be restored", ({
      suspensionTrail,
    }) => {
      expect(suspensionTrail).toStrictEqual({
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
      Effect.runPromise(
        Effect.gen(function* suspendAdmin() {
          yield* addUser({ role: ROLE.administrator, userId: "other" });
          const sessionId = yield* signInAs(ADMIN_PERMISSION.operator);
          return yield* setMemberState({
            accountState: ACCOUNT_STATE.suspended,
            memberId: "other",
            sessionId,
          });
        }).pipe(
          Effect.flip,
          Effect.map((failure) => failure._tag),
          Effect.provide(TestDatabase),
        ),
      ));

    it("does not touch the administrator", ({ tag }) => {
      expect(tag).toBe("TargetUnavailable");
    });
  });
});

describe("admin reads and interview conversations", () => {
  const conversationToken = "admin-must-not-read-this-conversation";

  describe("listing members", () => {
    const it = test.extend("listingExposesConversation", () =>
      Effect.runPromise(
        Effect.gen(function* listMembers() {
          yield* addUser({ userId: "member" });
          yield* startInterview("member", {
            messages: [{ role: "member", text: conversationToken }],
            phase: "saved",
            sheet: { nickname: "たろう" },
            skipped: [],
          });
          yield* addUser({ role: ROLE.administrator, userId: "admin" });
          const sessionId = yield* addSession({ audience: APPLICATION.admin, userId: "admin" });
          const listed = yield* listUsers(sessionId, { limit: 20, offset: 0 });
          const serialized = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
            listed,
          );
          return serialized.includes(conversationToken);
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("never exposes interview conversation content", ({ listingExposesConversation }) => {
      expect(listingExposesConversation).toBe(false);
    });
  });

  describe("reading agreements", () => {
    const it = test.extend("agreementsExposeConversation", () =>
      Effect.runPromise(
        Effect.gen(function* readAgreements() {
          yield* addUser({ userId: "member" });
          yield* startInterview("member", {
            messages: [{ role: "member", text: conversationToken }],
            phase: "saved",
            sheet: {},
            skipped: [],
          });
          yield* addUser({ role: ROLE.administrator, userId: "admin" });
          const sessionId = yield* addSession({ audience: APPLICATION.admin, userId: "admin" });
          const listed = yield* listAgreementVersions(sessionId);
          const [listedVersion] = listed.versions;
          const readVersion =
            listedVersion === undefined
              ? undefined
              : yield* readAgreementVersion(sessionId, listedVersion.version);
          const serialized = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
            listed,
            readVersion,
          });
          return serialized.includes(conversationToken);
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("never exposes interview conversation content", ({ agreementsExposeConversation }) => {
      expect(agreementsExposeConversation).toBe(false);
    });
  });
});

describe("admin and staff reads and direct messages", () => {
  const directMessageBody = "admin-must-not-read-this-direct-message";

  const it = test.extend("readsExposeDirectMessage", () =>
    Effect.runPromise(
      Effect.gen(function* readAfterMessaging() {
        yield* addUser({ userId: "sender" });
        yield* addUser({ userId: "recipient" });
        const sentAt = DateTime.toDate(DateTime.makeUnsafe("2026-09-20T00:00:00.000Z"));
        yield* query((database) =>
          database.insert(conversation).values({
            directKey: "recipient:sender",
            id: "thread",
            kind: CONVERSATION_KIND.direct,
            lastMessageAt: sentAt,
          }),
        );
        yield* query((database) =>
          database.insert(conversationParticipant).values([
            {
              conversationId: "thread",
              id: "part-sender",
              joinedAt: sentAt,
              memberId: "sender",
              memberName: "sender",
            },
            {
              conversationId: "thread",
              id: "part-recipient",
              joinedAt: sentAt,
              memberId: "recipient",
              memberName: "recipient",
            },
          ]),
        );
        yield* query((database) =>
          database.insert(directMessage).values({
            body: directMessageBody,
            conversationId: "thread",
            createdAt: sentAt,
            id: "message",
            senderId: "sender",
            senderName: "sender",
          }),
        );
        yield* addUser({ role: ROLE.administrator, userId: "operator" });
        const sessionId = yield* addSession({ audience: APPLICATION.admin, userId: "operator" });
        const listed = yield* listUsers(sessionId, { limit: 20, offset: 0 });
        const member = yield* getMember(sessionId, "sender");
        const overview = yield* dashboardStaff.overviewWithoutPii();
        const audit = yield* dashboardStaff.auditEvents({ limit: 20, offset: 0 });
        const serialized = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
          audit,
          listed,
          member,
          overview,
        });
        return serialized.includes(directMessageBody);
      }).pipe(Effect.provide(TestDatabase)),
    ));

  it("never include direct message bodies", ({ readsExposeDirectMessage }) => {
    expect(readsExposeDirectMessage).toBe(false);
  });
});
