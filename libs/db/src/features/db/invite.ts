import {
  ACCOUNT_STATE,
  AUDIT_ACTION,
  audienceRoles,
  type AccountPermission,
  type Application,
} from "@repo/config";
import { and, eq, gt, isNull, type SQL } from "drizzle-orm";
import { DateTime, Duration, Effect } from "effect";

import { auditRow, type AuditEntry } from "./audit.ts";
import { query } from "./database.ts";
import { freshId } from "./fresh-id.ts";
import { InviteRejected } from "./invite-rejected.ts";
import { account, auditEvent, invite, user } from "./schema.ts";

import type { DatabaseFailure } from "./database-failure.ts";

const INVITE_DAYS = 7;
const INVITE_LIFETIME_MS = Duration.toMillis(Duration.days(INVITE_DAYS));

const hashInviteToken = (rawToken: string): Effect.Effect<string> =>
  Effect.map(
    Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken))),
    (digest) =>
      [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  );

const freshToken = Effect.map(Effect.all([freshId, freshId]), ([head, tail]) =>
  `${head}${tail}`.replaceAll("-", ""),
);

const mentionsConsumed = (cause: unknown): boolean =>
  cause instanceof Error &&
  (cause.message.includes("INVITE_CONSUMED") || mentionsConsumed(cause.cause));

const rejectConsumed = <Value, Requirements>(
  effect: Effect.Effect<Value, DatabaseFailure, Requirements>,
): Effect.Effect<Value, DatabaseFailure | InviteRejected, Requirements> =>
  effect.pipe(
    Effect.mapError((failure) =>
      mentionsConsumed(failure.cause) ? new InviteRejected({ reason: "missing" }) : failure,
    ),
  );

const openInvite = (audience: Application, checkedAt: Date): SQL | undefined =>
  and(eq(invite.audience, audience), isNull(invite.acceptedAt), gt(invite.expiresAt, checkedAt));

const findRegistered = Effect.fn("findRegistered")(function* findRegistered(email: string) {
  const [registered] = yield* query((database) =>
    database.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1),
  );
  return registered;
});

const rejectTaken = Effect.fn("rejectTaken")(function* rejectTaken(
  candidate: Readonly<{ audience: Application; checkedAt: Date; email: string }>,
) {
  if ((yield* findRegistered(candidate.email)) !== undefined) {
    return yield* new InviteRejected({ reason: "registered" });
  }
  const [pending] = yield* query((database) =>
    database
      .select({ id: invite.id })
      .from(invite)
      .where(
        and(eq(invite.email, candidate.email), openInvite(candidate.audience, candidate.checkedAt)),
      )
      .limit(1),
  );
  if (pending !== undefined) {
    return yield* new InviteRejected({ reason: "pending" });
  }
});

const previewInvite = Effect.fn("previewInvite")(function* previewInvite(
  rawToken: string,
  audience: Application,
) {
  const tokenHash = yield* hashInviteToken(rawToken);
  const checkedAt = DateTime.toDate(yield* DateTime.now);
  const [open] = yield* query((database) =>
    database
      .select({ email: invite.email, id: invite.id, permission: invite.permission })
      .from(invite)
      .where(and(eq(invite.tokenHash, tokenHash), openInvite(audience, checkedAt)))
      .limit(1),
  );
  return open;
});

const issueInvite = Effect.fn("issueInvite")(function* issueInvite(draft: {
  readonly audience: Application;
  readonly audit: Omit<AuditEntry, "targetId">;
  readonly email: string;
  readonly lifetimeMilliseconds?: number;
  readonly permission: AccountPermission;
}) {
  const email = draft.email.trim().toLowerCase();
  const issuedInstant = yield* DateTime.now;
  const issuedAt = DateTime.toDate(issuedInstant);
  const expiresAt = DateTime.toDate(
    DateTime.makeUnsafe(
      DateTime.toEpochMillis(issuedInstant) + (draft.lifetimeMilliseconds ?? INVITE_LIFETIME_MS),
    ),
  );
  yield* rejectTaken({ audience: draft.audience, checkedAt: issuedAt, email });
  const rawToken = yield* freshToken;
  const tokenHash = yield* hashInviteToken(rawToken);
  const [inviteId, auditId] = yield* Effect.all([freshId, freshId]);
  yield* query((database) =>
    database.batch([
      database.insert(invite).values({
        audience: draft.audience,
        createdAt: issuedAt,
        email,
        expiresAt,
        id: inviteId,
        inviterId: draft.audit.actorId,
        permission: draft.permission,
        tokenHash,
      }),
      database
        .insert(auditEvent)
        .values(auditRow({ ...draft.audit, id: auditId, targetId: inviteId })),
    ]),
  );
  return { email, expiresAt, id: inviteId, token: rawToken };
});

const acceptInvite = Effect.fn("acceptInvite")(function* acceptInvite(accepted: {
  readonly audience: Application;
  readonly name: string;
  readonly passwordHash: string;
  readonly rawToken: string;
}) {
  const open = yield* previewInvite(accepted.rawToken, accepted.audience);
  if (open === undefined) {
    return yield* new InviteRejected({ reason: "missing" });
  }
  if ((yield* findRegistered(open.email)) !== undefined) {
    return yield* new InviteRejected({ reason: "registered" });
  }
  const [userId, accountId, auditId] = yield* Effect.all([freshId, freshId, freshId]);
  const acceptedAt = DateTime.toDate(yield* DateTime.now);
  const role = audienceRoles[accepted.audience];
  yield* query((database) =>
    database.batch([
      database.update(invite).set({ acceptedAt }).where(eq(invite.id, open.id)),
      database.insert(user).values({
        accountState: ACCOUNT_STATE.active,
        createdAt: acceptedAt,
        email: open.email,
        emailVerified: true,
        id: userId,
        name: accepted.name,
        permission: open.permission,
        role,
        updatedAt: acceptedAt,
      }),
      database.insert(account).values({
        accountId: userId,
        createdAt: acceptedAt,
        id: accountId,
        password: accepted.passwordHash,
        providerId: "credential",
        updatedAt: acceptedAt,
        userId,
      }),
      database.insert(auditEvent).values(
        auditRow({
          action: AUDIT_ACTION.inviteAccepted,
          actorId: userId,
          actorKind: role,
          id: auditId,
          targetId: open.id,
        }),
      ),
    ]),
  ).pipe(rejectConsumed);
  return { email: open.email, permission: open.permission, role, userId };
});

export { acceptInvite, issueInvite, previewInvite };
