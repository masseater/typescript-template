import { type Application, type ProfileVisibility } from "@repo/config";
import {
  ADMIN_PERMISSION,
  AUTHENTICATION_METHOD,
  ROLE,
  STAFF_PERMISSION,
  type AccountPermission,
  type AccountState,
  type Role,
} from "@repo/config/identity";
import { eq } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { query, type Database } from "./database.ts";
import { freshId } from "./fresh-id.ts";
import { leaveRequest, withdrawnMember } from "./member-leave-schema.ts";
import {
  auditEvent,
  oauthAccessToken,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
  session,
  user,
} from "./schema.ts";

import type { DatabaseFailure } from "./database-failure.ts";

export const recordedAt = DateTime.toDate(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"));

const topPermission: Readonly<Record<Role, AccountPermission | null>> = {
  admin: ADMIN_PERMISSION.owner,
  member: null,
  staff: STAFF_PERMISSION.editor,
};

export const addUser = (added: {
  readonly userId: string;
  readonly role?: Role;
  readonly permission?: AccountPermission;
  readonly accountState?: AccountState;
  readonly emailVerified?: boolean;
  readonly email?: string;
  readonly name?: string;
  readonly profile?: string;
  readonly searchable?: boolean;
  readonly visibility?: ProfileVisibility;
}): Effect.Effect<void, DatabaseFailure, Database> => {
  const role = added.role ?? ROLE.member;
  return query((database) =>
    database
      .insert(user)
      .values({
        ...(added.accountState === undefined ? {} : { accountState: added.accountState }),
        createdAt: recordedAt,
        email: added.email ?? `${added.userId}@example.com`,
        emailVerified: added.emailVerified ?? true,
        id: added.userId,
        name: added.name ?? added.userId,
        permission: added.permission ?? topPermission[role],
        ...(added.profile === undefined ? {} : { profile: added.profile }),
        role,
        updatedAt: recordedAt,
        ...(added.searchable === undefined ? {} : { searchable: added.searchable }),
        ...(added.visibility === undefined ? {} : { visibility: added.visibility }),
      })
      .then(() => undefined),
  );
};

export const auditActionsOf = Effect.fn("auditActionsOf")(function* auditActionsOf(
  targetId: string,
) {
  const auditTrail = yield* query((database) =>
    database
      .select({
        action: auditEvent.action,
        actorId: auditEvent.actorId,
        actorKind: auditEvent.actorKind,
        channel: auditEvent.channel,
      })
      .from(auditEvent)
      .where(eq(auditEvent.targetId, targetId))
      .orderBy(auditEvent.createdAt),
  );
  return auditTrail;
});

const SESSION_LIFETIME_MS = 60_000;

export const addSession = Effect.fn("addSession")(function* addSession(opened: {
  readonly userId: string;
  readonly audience: Application;
  readonly strong?: boolean;
  readonly token?: string;
}) {
  const sessionId = yield* freshId;
  const owners = yield* query((database) =>
    database.select().from(user).where(eq(user.id, opened.userId)),
  );
  const securityVersion = owners.at(0)?.securityVersion ?? 0;
  const createdAt = DateTime.toDate(yield* DateTime.now);
  const effectNow = DateTime.toEpochMillis(yield* DateTime.now);
  const wallNow = DateTime.toEpochMillis(DateTime.nowUnsafe());
  const expiresAt = DateTime.toDate(
    DateTime.makeUnsafe(Math.max(effectNow, wallNow) + SESSION_LIFETIME_MS),
  );
  const token = opened.token ?? (yield* freshId);
  yield* query((database) =>
    database
      .insert(session)
      .values({
        audience: opened.audience,
        authenticationMethod:
          opened.strong === false
            ? AUTHENTICATION_METHOD.password
            : AUTHENTICATION_METHOD.passwordTotp,
        createdAt,
        expiresAt,
        id: sessionId,
        securityVersion,
        token,
        updatedAt: createdAt,
        userId: opened.userId,
      })
      .then(() => undefined),
  );
  return sessionId;
});

export const addOAuthGrant = Effect.fn("addOAuthGrant")(function* addOAuthGrant(userId: string) {
  const clientId = `client-${userId}`;
  const scopes = '["wiki:read"]';
  yield* query((database) =>
    database
      .batch([
        database.insert(oauthClient).values({ clientId, id: clientId, redirectUris: "[]" }),
        database.insert(oauthRefreshToken).values({
          clientId,
          id: `refresh-${userId}`,
          scopes,
          token: `refresh-token-${userId}`,
          userId,
        }),
        database.insert(oauthAccessToken).values({
          clientId,
          id: `access-${userId}`,
          refreshId: `refresh-${userId}`,
          scopes,
          token: `access-token-${userId}`,
          userId,
        }),
        database.insert(oauthConsent).values({ clientId, id: `consent-${userId}`, scopes, userId }),
      ])
      .then(() => undefined),
  );
});

export const oauthGrantCounts = Effect.fn("oauthGrantCounts")(function* oauthGrantCounts(
  userId: string,
) {
  const access = yield* query((database) =>
    database.select().from(oauthAccessToken).where(eq(oauthAccessToken.userId, userId)),
  );
  const refresh = yield* query((database) =>
    database.select().from(oauthRefreshToken).where(eq(oauthRefreshToken.userId, userId)),
  );
  const consent = yield* query((database) =>
    database.select().from(oauthConsent).where(eq(oauthConsent.userId, userId)),
  );
  return { access: access.length, consent: consent.length, refresh: refresh.length };
});

export const profileFieldsOf = Effect.fn("profileFieldsOf")(function* profileFieldsOf(
  userId: string,
) {
  const [listedProfile] = yield* query((database) =>
    database
      .select({ id: user.id, name: user.name, profile: user.profile })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
  );
  return listedProfile;
});

export const withdrawnSnapshotCount = Effect.fn("withdrawnSnapshotCount")(
  function* withdrawnSnapshotCount(memberId: string) {
    const snapshots = yield* query((database) =>
      database
        .select({ memberId: withdrawnMember.memberId })
        .from(withdrawnMember)
        .where(eq(withdrawnMember.memberId, memberId)),
    );
    return snapshots.length;
  },
);

export const keepPhotos = (memberId: string): Effect.Effect<void> =>
  Effect.asVoid(Effect.succeed(memberId));

export const expireLeave = (memberId: string): Effect.Effect<void, DatabaseFailure, Database> =>
  query((database) =>
    database
      .update(leaveRequest)
      .set({ purgeAt: DateTime.toDate(DateTime.makeUnsafe("2020-01-01T00:00:00.000Z")) })
      .where(eq(leaveRequest.memberId, memberId))
      .then(() => undefined),
  );

export const liveSessionCount = Effect.fn("liveSessionCount")(function* liveSessionCount(
  userId: string,
) {
  const sessions = yield* query((database) =>
    database.select({ id: session.id }).from(session).where(eq(session.userId, userId)),
  );
  return sessions.length;
});
