import { APPLICATION, ROLE, STAFF_PERMISSION } from "@repo/config";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { addSession, addUser, auditActionsOf } from "./records-fixture.ts";
import { inviteStaff, listStaff, removeStaff, setStaffPermission } from "./staff.ts";
import { TestDatabase } from "./testing.ts";

const signInAs = Effect.fn("signInAs")(function* signInAs(
  permission: (typeof STAFF_PERMISSION)[keyof typeof STAFF_PERMISSION],
) {
  yield* addUser({ permission, role: ROLE.staff, userId: `actor-${permission}` });
  return yield* addSession({ audience: APPLICATION.wiki, userId: `actor-${permission}` });
});

describe("staff permission levels", () => {
  describe.for(["inviting", "changing a level", "removing", "listing"] as const)(
    "a viewer %s",
    (operation) => {
      const it = test.extend("tag", () =>
        Effect.runPromise(
          Effect.gen(function* viewerWrites() {
            yield* addUser({ role: ROLE.staff, userId: "editor" });
            const sessionId = yield* signInAs(STAFF_PERMISSION.viewer);
            const operations = {
              "changing a level": setStaffPermission({
                permission: STAFF_PERMISSION.viewer,
                sessionId,
                staffId: "editor",
              }),
              inviting: inviteStaff({
                email: "new@example.com",
                permission: STAFF_PERMISSION.viewer,
                sessionId,
              }),
              listing: listStaff(sessionId),
              removing: removeStaff(sessionId, "editor"),
            };
            return yield* operations[operation];
          }).pipe(
            Effect.flip,
            Effect.map((failure) => failure._tag),
            Effect.provide(TestDatabase),
          ),
        ));

      it("is rejected with the missing level", ({ tag }) => {
        expect(tag).toBe("PermissionRequired");
      });
    },
  );

  describe("an editor", () => {
    const it = test.extend("editorChanges", () =>
      Effect.runPromise(
        Effect.gen(function* editorActs() {
          yield* addUser({
            permission: STAFF_PERMISSION.viewer,
            role: ROLE.staff,
            userId: "other",
          });
          const sessionId = yield* signInAs(STAFF_PERMISSION.editor);
          const promoted = yield* setStaffPermission({
            permission: STAFF_PERMISSION.editor,
            sessionId,
            staffId: "other",
          });
          const staff = yield* listStaff(sessionId);
          const removed = yield* removeStaff(sessionId, "other");
          const remaining = yield* listStaff(sessionId);
          const audit = yield* auditActionsOf("other");
          return {
            audit: audit.map((auditEntry) => [
              auditEntry.action,
              auditEntry.actorId,
              auditEntry.actorKind,
            ]),
            promoted,
            remaining: remaining.map((member) => member.id),
            removed,
            staff: staff.map((member) => [member.id, member.permission]),
          };
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("manages staff and every change is audited", ({ editorChanges }) => {
      expect(editorChanges).toStrictEqual({
        audit: [
          ["staff_permission_changed", "actor-editor", ROLE.staff],
          ["staff_removed", "actor-editor", ROLE.staff],
        ],
        promoted: { id: "other", permission: STAFF_PERMISSION.editor },
        remaining: ["actor-editor"],
        removed: { id: "other" },
        staff: [
          ["actor-editor", STAFF_PERMISSION.editor],
          ["other", STAFF_PERMISSION.editor],
        ],
      });
    });
  });

  describe("an editor removing themselves", () => {
    const it = test.extend("tag", () =>
      Effect.runPromise(
        Effect.gen(function* selfRemove() {
          const sessionId = yield* signInAs(STAFF_PERMISSION.editor);
          return yield* removeStaff(sessionId, "actor-editor");
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

  describe("the last editor demoting themselves", () => {
    const it = test.extend("tag", () =>
      Effect.runPromise(
        Effect.gen(function* lastEditor() {
          const sessionId = yield* signInAs(STAFF_PERMISSION.editor);
          return yield* setStaffPermission({
            permission: STAFF_PERMISSION.viewer,
            sessionId,
            staffId: "actor-editor",
          });
        }).pipe(
          Effect.flip,
          Effect.map((failure) => failure._tag),
          Effect.provide(TestDatabase),
        ),
      ));

    it("is refused to keep one editor", ({ tag }) => {
      expect(tag).toBe("LastEditorRequired");
    });
  });

  describe("an administrator session on the wiki", () => {
    const it = test.extend("tag", () =>
      Effect.runPromise(
        Effect.gen(function* adminActs() {
          yield* addUser({ role: ROLE.administrator, userId: "admin" });
          const sessionId = yield* addSession({ audience: APPLICATION.wiki, userId: "admin" });
          return yield* listStaff(sessionId);
        }).pipe(
          Effect.flip,
          Effect.map((failure) => failure._tag),
          Effect.provide(TestDatabase),
        ),
      ));

    it("cannot use the staff module", ({ tag }) => {
      expect(tag).toBe("AdminStrongSessionRequired");
    });
  });

  describe("removing a member through the staff operation", () => {
    const it = test.extend("tag", () =>
      Effect.runPromise(
        Effect.gen(function* removeMember() {
          yield* addUser({ userId: "member" });
          const sessionId = yield* signInAs(STAFF_PERMISSION.editor);
          return yield* removeStaff(sessionId, "member");
        }).pipe(
          Effect.flip,
          Effect.map((failure) => failure._tag),
          Effect.provide(TestDatabase),
        ),
      ));

    it("does not touch the member", ({ tag }) => {
      expect(tag).toBe("TargetUnavailable");
    });
  });
});
