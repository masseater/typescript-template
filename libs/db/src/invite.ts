import {
  ACCOUNT_STATE,
  APPLICATION,
  ROLE,
  type AccountPermission,
  type Application,
  adminPermissions,
  staffPermissions,
} from "@repo/config";
import { and, eq, gt, isNull } from "drizzle-orm";
import { Effect } from "effect";

import { query, type DrizzleDatabase } from "./database.ts";
import { InviteRejected } from "./invite-rejected.ts";
import { account, auditEvent, invite, user } from "./schema.ts";

import type { AuditAction } from "./schema.ts";

const INVITE_DAYS = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const INVITE_LIFETIME_MS =
  INVITE_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

const hashInviteToken = (rawToken: string): Effect.Effect<string> =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  });

const freshToken = (): string => `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");

const roleForAudience = (audience: Application): typeof ROLE.administrator | typeof ROLE.staff =>
  audience === APPLICATION.admin ? ROLE.administrator : ROLE.staff;

const permissionFits = (audience: Application, permission: AccountPermission): boolean => {
  const allowed: readonly string[] =
    audience === APPLICATION.admin ? adminPermissions : staffPermissions;
  return allowed.includes(permission);
};

const findOpenInvite = Effect.fn("findOpenInvite")(function* findOpenInvite(sought: {
  readonly audience: Application;
  readonly email: string;
}) {
  const now = new Date();
  const [open] = yield* query((database) =>
    database
      .select({
        email: invite.email,
        id: invite.id,
        permission: invite.permission,
      })
      .from(invite)
      .where(
        and(
          eq(invite.audience, sought.audience),
          eq(invite.email, sought.email.toLowerCase()),
          isNull(invite.acceptedAt),
          gt(invite.expiresAt, now),
        ),
      )
      .limit(1),
  );
  return open ?? null;
});

const previewInvite = Effect.fn("previewInvite")(function* previewInvite(
  rawToken: string,
  audience: Application,
) {
  const tokenHash = yield* hashInviteToken(rawToken);
  const now = new Date();
  const [open] = yield* query((database) =>
    database
      .select({ email: invite.email, permission: invite.permission })
      .from(invite)
      .where(
        and(
          eq(invite.tokenHash, tokenHash),
          eq(invite.audience, audience),
          isNull(invite.acceptedAt),
          gt(invite.expiresAt, now),
        ),
      )
      .limit(1),
  );
  return open ?? null;
});

const issueInvite = Effect.fn("issueInvite")(function* issueInvite(draft: {
  readonly action: AuditAction;
  readonly audience: Application;
  readonly email: string;
  readonly inviterId: string;
  readonly permission: AccountPermission;
}) {
  if (!permissionFits(draft.audience, draft.permission)) {
    return yield* new InviteRejected({ reason: "permission" });
  }
  const email = draft.email.toLowerCase();
  const [registered] = yield* query((database) =>
    database.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1),
  );
  if (registered) {
    return yield* new InviteRejected({ reason: "registered" });
  }
  if ((yield* findOpenInvite({ audience: draft.audience, email })) !== null) {
    return yield* new InviteRejected({ reason: "pending" });
  }
  const rawToken = freshToken();
  const tokenHash = yield* hashInviteToken(rawToken);
  const now = new Date();
  const inviteId = crypto.randomUUID();
  yield* query(async (database): Promise<void> => {
    await database.batch([
      database.insert(invite).values({
        audience: draft.audience,
        createdAt: now,
        email,
        expiresAt: new Date(now.getTime() + INVITE_LIFETIME_MS),
        id: inviteId,
        inviterId: draft.inviterId,
        permission: draft.permission,
        tokenHash,
      }),
      database.insert(auditEvent).values({
        action: draft.action,
        actorId: draft.inviterId,
        createdAt: now,
        id: crypto.randomUUID(),
        targetId: inviteId,
      }),
    ]);
  });
  return { email, token: rawToken };
});

const acceptInvite = Effect.fn("acceptInvite")(function* acceptInvite(accepted: {
  readonly audience: Application;
  readonly name: string;
  readonly passwordHash: string;
  readonly rawToken: string;
}) {
  const open = yield* previewInvite(accepted.rawToken, accepted.audience);
  if (open === null) {
    return yield* new InviteRejected({ reason: "missing" });
  }
  const [registered] = yield* query((database) =>
    database.select({ id: user.id }).from(user).where(eq(user.email, open.email)).limit(1),
  );
  if (registered) {
    return yield* new InviteRejected({ reason: "registered" });
  }
  const userId = crypto.randomUUID();
  const now = new Date();
  const tokenHash = yield* hashInviteToken(accepted.rawToken);
  yield* query(async (database: DrizzleDatabase): Promise<void> => {
    await database.batch([
      database.insert(user).values({
        accountState: ACCOUNT_STATE.active,
        createdAt: now,
        email: open.email,
        emailVerified: true,
        id: userId,
        name: accepted.name,
        permission: open.permission,
        role: roleForAudience(accepted.audience),
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
      database
        .update(invite)
        .set({ acceptedAt: now })
        .where(and(eq(invite.tokenHash, tokenHash), isNull(invite.acceptedAt))),
    ]);
  });
  return { email: open.email, userId };
});

export { acceptInvite, findOpenInvite, issueInvite, previewInvite };
