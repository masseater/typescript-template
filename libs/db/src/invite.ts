import {
  ACCOUNT_STATE,
  AUDIT_ACTION,
  audienceRoles,
  type AccountPermission,
  type Application,
} from "@repo/config";
import { and, eq, gt, isNull, type SQL } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { auditRow, type AuditEntry } from "./audit.ts";
import { query } from "./database.ts";
import { InviteRejected } from "./invite-rejected.ts";
import { account, auditEvent, invite, user } from "./schema.ts";

import type { DatabaseFailure } from "./database-failure.ts";

const INVITE_DAYS = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const INVITE_LIFETIME_MS =
  INVITE_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

const hashInviteToken = (rawToken: string): Effect.Effect<string> =>
  Effect.promise(() =>
    crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(rawToken))
      .then((digest) =>
        [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
      ),
  );

const freshToken = (): string => `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");

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
  const nowInstant = yield* DateTime.now;
  const now = DateTime.toDate(nowInstant);
  const expiresAt = DateTime.toDate(
    DateTime.makeUnsafe(
      DateTime.toEpochMillis(nowInstant) + (draft.lifetimeMilliseconds ?? INVITE_LIFETIME_MS),
    ),
  );
  if ((yield* findRegistered(email)) !== undefined) {
    return yield* new InviteRejected({ reason: "registered" });
  }
  const [pending] = yield* query((database) =>
    database
      .select({ id: invite.id })
      .from(invite)
      .where(and(eq(invite.email, email), openInvite(draft.audience, now)))
      .limit(1),
  );
  if (pending !== undefined) {
    return yield* new InviteRejected({ reason: "pending" });
  }
  const rawToken = freshToken();
  const tokenHash = yield* hashInviteToken(rawToken);
  const inviteId = crypto.randomUUID();
  yield* query((database) =>
    database
      .batch([
        database.insert(invite).values({
          audience: draft.audience,
          createdAt: now,
          email,
          expiresAt,
          id: inviteId,
          inviterId: draft.audit.actorId,
          permission: draft.permission,
          tokenHash,
        }),
        database.insert(auditEvent).values(auditRow({ ...draft.audit, targetId: inviteId })),
      ])
      .then(() => undefined),
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
  const userId = crypto.randomUUID();
  const now = DateTime.toDate(yield* DateTime.now);
  const role = audienceRoles[accepted.audience];
  yield* query((database) =>
    database
      .batch([
        database.update(invite).set({ acceptedAt: now }).where(eq(invite.id, open.id)),
        database.insert(user).values({
          accountState: ACCOUNT_STATE.active,
          createdAt: now,
          email: open.email,
          emailVerified: true,
          id: userId,
          name: accepted.name,
          permission: open.permission,
          role,
          updatedAt: now,
        }),
        database.insert(account).values({
          accountId: userId,
          createdAt: now,
          id: crypto.randomUUID(),
          password: accepted.passwordHash,
          providerId: "credential",
          updatedAt: now,
          userId,
        }),
        database.insert(auditEvent).values(
          auditRow({
            action: AUDIT_ACTION.inviteAccepted,
            actorId: userId,
            actorKind: role,
            targetId: open.id,
          }),
        ),
      ])
      .then(() => undefined),
  ).pipe(rejectConsumed);
  return { email: open.email, permission: open.permission, role, userId };
});

export { acceptInvite, issueInvite, previewInvite };
