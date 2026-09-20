import {
  ACCOUNT_STATE,
  APPLICATION,
  ROLE,
  STAFF_PERMISSION,
  strongAuthenticationMethods,
  type StaffPermission,
} from "@repo/config";
import { and, desc, eq, exists, gt, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { Effect } from "effect";

import { query, type DrizzleDatabase } from "./database.ts";
import { DatabaseFailure } from "./database-failure.ts";
import { issueInvite } from "./invite.ts";
import { LastAdminRequired } from "./last-admin-required.ts";
import { OperationForbidden } from "./operation-forbidden.ts";
import { AdminStrongSessionRequired } from "./admin-strong-session-required.ts";
import {
  AUDIT_ACTION,
  auditEvent,
  featureFlag,
  flagChange,
  session,
  user,
} from "./schema.ts";
import { getSessionSecurity } from "./security.ts";
import { TargetUnavailable } from "./target-unavailable.ts";

const mentionsLastEditor = (cause: unknown): boolean =>
  cause instanceof Error &&
  (cause.message.includes("LAST_ADMIN_REQUIRED") || mentionsLastEditor(cause.cause));

const protectLastEditor = <Value, Requirements>(
  effect: Effect.Effect<Value, DatabaseFailure, Requirements>,
): Effect.Effect<Value, DatabaseFailure | LastAdminRequired, Requirements> =>
  effect.pipe(
    Effect.mapError((failure) =>
      mentionsLastEditor(failure.cause) ? new LastAdminRequired() : failure,
    ),
  );

const requireStaff = Effect.fn("requireStaff")(function* requireStaff(sessionId: string) {
  const actor = yield* getSessionSecurity(sessionId, APPLICATION.wiki);
  if (
    actor?.user.role !== ROLE.staff ||
    actor.user.accountState !== ACCOUNT_STATE.active ||
    !actor.user.emailVerified ||
    !strongAuthenticationMethods.some((method) => method === actor.session.authenticationMethod)
  ) {
    return yield* new AdminStrongSessionRequired();
  }
  return actor;
});

const liveStaff = (database: DrizzleDatabase, sessionId: string): SQL => {
  const actor = alias(user, "staff_actor");
  const checkedAt = new Date();
  const liveSession = and(
    eq(session.id, sessionId),
    eq(session.audience, APPLICATION.wiki),
    eq(actor.role, ROLE.staff),
    eq(actor.accountState, ACCOUNT_STATE.active),
    eq(actor.emailVerified, true),
    eq(session.securityVersion, actor.securityVersion),
    gt(session.expiresAt, checkedAt),
    inArray(session.authenticationMethod, strongAuthenticationMethods),
  );
  return exists(
    database
      .select({ id: session.id })
      .from(session)
      .innerJoin(actor, eq(session.userId, actor.id))
      .where(liveSession),
  );
};

const requireEditor = Effect.fn("requireEditor")(function* requireEditor(sessionId: string) {
  const actor = yield* requireStaff(sessionId);
  if (actor.user.permission !== STAFF_PERMISSION.edit) {
    return yield* new OperationForbidden();
  }
  return actor;
});

export const listStaff = Effect.fn("listStaff")(function* listStaff(sessionId: string) {
  yield* requireEditor(sessionId);
  return yield* query((database) =>
    database
      .select({
        email: user.email,
        id: user.id,
        name: user.name,
        permission: user.permission,
      })
      .from(user)
      .where(and(eq(user.role, ROLE.staff), liveStaff(database, sessionId)))
      .orderBy(desc(user.createdAt), user.id),
  );
});

export const inviteStaff = Effect.fn("inviteStaff")(function* inviteStaff(draft: {
  readonly email: string;
  readonly permission: StaffPermission;
  readonly sessionId: string;
}) {
  const actor = yield* requireEditor(draft.sessionId);
  return yield* issueInvite({
    action: AUDIT_ACTION.staffInvited,
    audience: APPLICATION.wiki,
    email: draft.email,
    inviterId: actor.user.id,
    permission: draft.permission,
  });
});

export const setStaffPermission = Effect.fn("setStaffPermission")(function* setStaffPermission(
  change: {
    readonly permission: StaffPermission;
    readonly sessionId: string;
    readonly staffId: string;
  },
) {
  const actor = yield* requireEditor(change.sessionId);
  const [changedStaff] = yield* query(async (database) => {
    const permissionChange = database
      .update(user)
      .set({ permission: change.permission, updatedAt: new Date() })
      .where(
        and(
          eq(user.id, change.staffId),
          eq(user.role, ROLE.staff),
          liveStaff(database, change.sessionId),
        ),
      )
      .returning({ id: user.id, permission: user.permission });
    const audit = database.insert(auditEvent).values({
      action: AUDIT_ACTION.staffPermissionChanged,
      actorId: actor.user.id,
      createdAt: new Date(),
      id: crypto.randomUUID(),
      targetId: change.staffId,
    });
    return database.batch([permissionChange, audit] as const);
  }).pipe(protectLastEditor);
  const [changed] = changedStaff;
  if (!changed) {
    return yield* new TargetUnavailable();
  }
  return changed;
});

export const removeStaff = Effect.fn("removeStaff")(function* removeStaff(
  sessionId: string,
  staffId: string,
) {
  const actor = yield* requireEditor(sessionId);
  if (actor.user.id === staffId) {
    return yield* new TargetUnavailable();
  }
  const [removedStaff] = yield* query(async (database) => {
    const removal = database
      .delete(user)
      .where(and(eq(user.id, staffId), eq(user.role, ROLE.staff), liveStaff(database, sessionId)))
      .returning({ id: user.id });
    const audit = database.insert(auditEvent).values({
      action: AUDIT_ACTION.staffRemoved,
      actorId: actor.user.id,
      createdAt: new Date(),
      id: crypto.randomUUID(),
      targetId: staffId,
    });
    return database.batch([removal, audit] as const);
  }).pipe(protectLastEditor);
  const [removed] = removedStaff;
  if (!removed) {
    return yield* new TargetUnavailable();
  }
  return removed;
});

export const listFeatureFlags = Effect.fn("listFeatureFlags")(function* listFeatureFlags(
  sessionId: string,
) {
  yield* requireStaff(sessionId);
  return yield* query((database) =>
    database
      .select({ enabled: featureFlag.enabled, flagKey: featureFlag.flagKey })
      .from(featureFlag)
      .where(liveStaff(database, sessionId))
      .orderBy(featureFlag.flagKey),
  );
});

export const setFeatureFlag = Effect.fn("setFeatureFlag")(function* setFeatureFlag(change: {
  readonly enabled: boolean;
  readonly flagKey: string;
  readonly sessionId: string;
}) {
  const actor = yield* requireEditor(change.sessionId);
  const changedAt = new Date();
  yield* query(async (database): Promise<void> => {
    await database.batch([
      database
        .insert(featureFlag)
        .values({ enabled: change.enabled, flagKey: change.flagKey, updatedAt: changedAt })
        .onConflictDoUpdate({
          set: { enabled: change.enabled, updatedAt: changedAt },
          target: featureFlag.flagKey,
        }),
      database.insert(flagChange).values({
        actorId: actor.user.id,
        changedAt,
        enabled: change.enabled,
        flagKey: change.flagKey,
        id: crypto.randomUUID(),
      }),
      database.insert(auditEvent).values({
        action: AUDIT_ACTION.flagChanged,
        actorId: actor.user.id,
        createdAt: changedAt,
        id: crypto.randomUUID(),
        targetId: change.flagKey,
      }),
    ]);
  });
  return { enabled: change.enabled, flagKey: change.flagKey };
});

export { AdminStrongSessionRequired, LastAdminRequired, OperationForbidden, TargetUnavailable };
