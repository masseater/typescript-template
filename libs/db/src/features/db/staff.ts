import {
  APPLICATION,
  AUDIT_ACTION,
  ROLE,
  STAFF_PERMISSION,
  staffPermissions,
  type StaffPermission,
} from "@repo/config";
import { and, desc, eq } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { auditWhenTargeted, type AuditEntry } from "./audit.ts";
import { query } from "./database.ts";
import { issueInvite } from "./invite.ts";
import { LastEditorRequired } from "./last-editor-required.ts";
import { liveStaff, requireStaff } from "./privileged-session.ts";
import { user } from "./schema.ts";
import { TargetUnavailable } from "./target-unavailable.ts";

import type { DatabaseFailure } from "./database-failure.ts";

const mentionsLastEditor = (cause: unknown): boolean =>
  cause instanceof Error &&
  (cause.message.includes("LAST_EDITOR_REQUIRED") || mentionsLastEditor(cause.cause));

const protectLastEditor = <Value, Requirements>(
  effect: Effect.Effect<Value, DatabaseFailure, Requirements>,
): Effect.Effect<Value, DatabaseFailure | LastEditorRequired, Requirements> =>
  effect.pipe(
    Effect.mapError((failure) =>
      mentionsLastEditor(failure.cause) ? LastEditorRequired.make() : failure,
    ),
  );

const staffActor = (
  actor: Readonly<{ user: Readonly<{ id: string }> }>,
  action: AuditEntry["action"],
): Omit<AuditEntry, "targetId"> => ({ action, actorId: actor.user.id, actorKind: ROLE.staff });

const staffPermissionOf = (permission: string | null): StaffPermission | undefined =>
  staffPermissions.find((level) => level === permission);

export const listStaff = Effect.fn("listStaff")(function* listStaff(sessionId: string) {
  yield* requireStaff(sessionId, STAFF_PERMISSION.editor);
  const checkedAt = DateTime.toDate(yield* DateTime.now);
  const staff = yield* query((database) =>
    database
      .select({
        createdAt: user.createdAt,
        email: user.email,
        id: user.id,
        name: user.name,
        permission: user.permission,
      })
      .from(user)
      .where(
        and(
          eq(user.role, ROLE.staff),
          liveStaff(database, { checkedAt, required: STAFF_PERMISSION.editor, sessionId }),
        ),
      )
      .orderBy(desc(user.createdAt), user.id),
  );
  return staff.map((member) => ({ ...member, permission: staffPermissionOf(member.permission) }));
});

export const inviteStaff = Effect.fn("inviteStaff")(function* inviteStaff(draft: {
  readonly email: string;
  readonly permission: StaffPermission;
  readonly sessionId: string;
}) {
  const actor = yield* requireStaff(draft.sessionId, STAFF_PERMISSION.editor);
  return yield* issueInvite({
    audience: APPLICATION.wiki,
    audit: staffActor(actor, AUDIT_ACTION.staffInvited),
    email: draft.email,
    permission: draft.permission,
  });
});

export const setStaffPermission = Effect.fn("setStaffPermission")(
  function* setStaffPermission(change: {
    readonly permission: StaffPermission;
    readonly sessionId: string;
    readonly staffId: string;
  }) {
    const { permission, sessionId, staffId } = change;
    const actor = yield* requireStaff(sessionId, STAFF_PERMISSION.editor);
    const updatedAt = DateTime.toDate(yield* DateTime.now);
    const [, changedStaff] = yield* query((database) => {
      const live = liveStaff(database, {
        checkedAt: updatedAt,
        required: STAFF_PERMISSION.editor,
        sessionId,
      });
      const audit = database.run(
        auditWhenTargeted(database, {
          actorIsLive: live,
          entry: { ...staffActor(actor, AUDIT_ACTION.staffPermissionChanged), targetId: staffId },
        }),
      );
      const transition = database
        .update(user)
        .set({ permission, updatedAt })
        .where(and(eq(user.id, staffId), eq(user.role, ROLE.staff), live))
        .returning({ id: user.id, permission: user.permission });
      return database.batch([audit, transition] as const);
    }).pipe(protectLastEditor);
    const [changed] = changedStaff;
    if (!changed) {
      return yield* TargetUnavailable.make();
    }
    return { id: changed.id, permission: staffPermissionOf(changed.permission) };
  },
);

export const removeStaff = Effect.fn("removeStaff")(function* removeStaff(
  sessionId: string,
  staffId: string,
) {
  const actor = yield* requireStaff(sessionId, STAFF_PERMISSION.editor);
  if (actor.user.id === staffId) {
    return yield* TargetUnavailable.make();
  }
  const checkedAt = DateTime.toDate(yield* DateTime.now);
  const [, removedStaff] = yield* query((database) => {
    const live = liveStaff(database, { checkedAt, required: STAFF_PERMISSION.editor, sessionId });
    const audit = database.run(
      auditWhenTargeted(database, {
        actorIsLive: live,
        entry: { ...staffActor(actor, AUDIT_ACTION.staffRemoved), targetId: staffId },
      }),
    );
    const removal = database
      .delete(user)
      .where(and(eq(user.id, staffId), eq(user.role, ROLE.staff), live))
      .returning({ id: user.id });
    return database.batch([audit, removal] as const);
  }).pipe(protectLastEditor);
  const [removed] = removedStaff;
  if (!removed) {
    return yield* TargetUnavailable.make();
  }
  return removed;
});

export { AdminStrongSessionRequired } from "./admin-strong-session-required.ts";
export { InviteRejected } from "./invite-rejected.ts";
export { LastEditorRequired } from "./last-editor-required.ts";
export { PermissionRequired } from "./permission-required.ts";
export { TargetUnavailable } from "./target-unavailable.ts";
