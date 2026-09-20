import { ROLE } from "@repo/config";
import { and, desc, eq, inArray, lte, ne } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { query } from "./database.ts";
import { DatabaseFailure } from "./database-failure.ts";
import { emailChange, memberMessage, withdrawnMember } from "./member-lifecycle-schema.ts";
import { onboardingSteps, stepOf } from "./member-social.ts";
import { agreementAcceptance, agreementVersion, follow, memberOnboarding, user } from "./schema.ts";

const withdrawalRetentionMs = 30 * 24 * 60 * 60 * 1000;
const emailChangeLifetimeMs = 24 * 60 * 60 * 1000;
const withdrawnMemberLabel = "退会した会員";

class LeaveUnavailable extends Schema.TaggedError<LeaveUnavailable>()("LeaveUnavailable", {}) {}

class RestorationUnavailable extends Schema.TaggedError<RestorationUnavailable>()(
  "RestorationUnavailable",
  {},
) {}

class EmailChangeUnavailable extends Schema.TaggedError<EmailChangeUnavailable>()(
  "EmailChangeUnavailable",
  {
    reason: Schema.Literals(["expired", "same", "taken", "unknown"]),
  },
) {}

const WithdrawalSnapshot = Schema.Struct({
  acceptances: Schema.Array(
    Schema.Struct({
      acceptedAt: Schema.Number,
      versionId: Schema.String,
    }),
  ),
  follows: Schema.Array(
    Schema.Struct({
      createdAt: Schema.Number,
      followeeId: Schema.String,
      followerId: Schema.String,
    }),
  ),
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  onboardingStep: Schema.Literals(onboardingSteps),
  profile: Schema.String,
  socialLinks: Schema.Array(Schema.String),
});

const hex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const randomToken = (): string => hex(crypto.getRandomValues(new Uint8Array(32)));

const digestToken = (token: string): Effect.Effect<string, DatabaseFailure> =>
  Effect.tryPromise({
    catch: (cause) => new DatabaseFailure({ cause }),
    try: async () => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      return hex(new Uint8Array(digest));
    },
  });

const decodeSnapshot = (
  stored: string,
): Effect.Effect<typeof WithdrawalSnapshot.Type, DatabaseFailure> =>
  Effect.try({
    catch: (cause) => new DatabaseFailure({ cause }),
    try: () => JSON.parse(stored),
  }).pipe(
    Effect.flatMap((parsed) =>
      Schema.decodeUnknownEffect(WithdrawalSnapshot)(parsed).pipe(
        Effect.mapError((cause) => new DatabaseFailure({ cause })),
      ),
    ),
  );

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const stageEmailChange = Effect.fn("stageEmailChange")(function* stageEmailChange(change: {
  readonly nextEmail: string;
  readonly now: Date;
  readonly userId: string;
}) {
  const nextEmail = normalizeEmail(change.nextEmail);
  const [owner] = yield* query((database) =>
    database.select().from(user).where(eq(user.id, change.userId)).limit(1),
  );
  if (owner?.role !== ROLE.member) {
    return yield* new EmailChangeUnavailable({ reason: "unknown" });
  }
  if (normalizeEmail(owner.email) === nextEmail) {
    return yield* new EmailChangeUnavailable({ reason: "same" });
  }
  const [taken] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, nextEmail), ne(user.id, owner.id)))
      .limit(1),
  );
  if (taken !== undefined) {
    return yield* new EmailChangeUnavailable({ reason: "taken" });
  }
  const token = randomToken();
  const tokenHash = yield* digestToken(token);
  const expiresAt = new Date(change.now.getTime() + emailChangeLifetimeMs);
  yield* query((database) =>
    database.delete(emailChange).where(eq(emailChange.userId, owner.id)),
  );
  yield* query((database) =>
    database.insert(emailChange).values({
      createdAt: change.now,
      expiresAt,
      id: crypto.randomUUID(),
      nextEmail,
      tokenHash,
      userId: owner.id,
    }),
  ).pipe(
    Effect.mapError((failure) =>
      failure.cause instanceof Error && failure.cause.message.includes("email_change_next_email")
        ? new EmailChangeUnavailable({ reason: "taken" })
        : failure,
    ),
  );
  return { nextEmail, previousEmail: owner.email, token };
});

const confirmEmailChange = Effect.fn("confirmEmailChange")(function* confirmEmailChange(
  token: string,
  now: Date,
) {
  const tokenHash = yield* digestToken(token);
  const [pending] = yield* query((database) =>
    database.select().from(emailChange).where(eq(emailChange.tokenHash, tokenHash)).limit(1),
  );
  if (pending === undefined) {
    return yield* new EmailChangeUnavailable({ reason: "unknown" });
  }
  if (pending.expiresAt.getTime() <= now.getTime()) {
    return yield* new EmailChangeUnavailable({ reason: "expired" });
  }
  const [conflict] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.email, pending.nextEmail), ne(user.id, pending.userId)))
      .limit(1),
  );
  if (conflict !== undefined) {
    return yield* new EmailChangeUnavailable({ reason: "taken" });
  }
  const [owner] = yield* query((database) =>
    database.select().from(user).where(eq(user.id, pending.userId)).limit(1),
  );
  if (owner === undefined) {
    return yield* new EmailChangeUnavailable({ reason: "unknown" });
  }
  yield* query(async (database) => {
    await database.transaction(async (tx) => {
      await tx
        .update(user)
        .set({ email: pending.nextEmail, updatedAt: now })
        .where(eq(user.id, owner.id));
      await tx.delete(emailChange).where(eq(emailChange.id, pending.id));
    });
  });
  return { nextEmail: pending.nextEmail, previousEmail: owner.email, userId: owner.id };
});

const leaveMember = Effect.fn("leaveMember")(function* leaveMember(left: {
  readonly immediate: boolean;
  readonly now: Date;
  readonly userId: string;
}) {
  const [member] = yield* query((database) =>
    database.select().from(user).where(eq(user.id, left.userId)).limit(1),
  );
  if (member?.role !== ROLE.member) {
    return yield* new LeaveUnavailable();
  }
  const follows = yield* query((database) =>
    database
      .select()
      .from(follow)
      .where(eq(follow.followerId, member.id)),
  );
  const followedBy = yield* query((database) =>
    database.select().from(follow).where(eq(follow.followeeId, member.id)),
  );
  const acceptances = yield* query((database) =>
    database
      .select()
      .from(agreementAcceptance)
      .where(eq(agreementAcceptance.userId, member.id)),
  );
  const onboardingStep = yield* stepOf(member.id);
  const snapshot = JSON.stringify({
    acceptances: acceptances.map((acceptance) => ({
      acceptedAt: acceptance.acceptedAt.getTime(),
      versionId: acceptance.versionId,
    })),
    follows: [...follows, ...followedBy].map((edge) => ({
      createdAt: edge.createdAt.getTime(),
      followeeId: edge.followeeId,
      followerId: edge.followerId,
    })),
    image: member.image,
    name: member.name,
    onboardingStep,
    profile: member.profile,
    socialLinks: member.socialLinks,
  } satisfies typeof WithdrawalSnapshot.Type);
  yield* query(async (database) => {
    await database.transaction(async (tx) => {
      if (!left.immediate) {
        await tx.delete(withdrawnMember).where(eq(withdrawnMember.email, member.email));
        await tx.insert(withdrawnMember).values({
          email: member.email,
          id: member.id,
          purgeAt: new Date(left.now.getTime() + withdrawalRetentionMs),
          requestedAt: left.now,
          snapshot,
        });
      }
      await tx.delete(user).where(eq(user.id, member.id));
    });
  });
});

const restorationFor = Effect.fn("restorationFor")(function* restorationFor(
  userId: string,
  now: Date,
) {
  const [member] = yield* query((database) =>
    database
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
  );
  if (member === undefined) {
    return { purgeAt: null, restorable: false as const };
  }
  const [withdrawn] = yield* query((database) =>
    database
      .select({ purgeAt: withdrawnMember.purgeAt })
      .from(withdrawnMember)
      .where(eq(withdrawnMember.email, member.email))
      .limit(1),
  );
  if (withdrawn === undefined || withdrawn.purgeAt.getTime() <= now.getTime()) {
    return { purgeAt: null, restorable: false as const };
  }
  return { purgeAt: withdrawn.purgeAt.getTime(), restorable: true as const };
});

const restoreMember = Effect.fn("restoreMember")(function* restoreMember(userId: string, now: Date) {
  const [member] = yield* query((database) =>
    database.select().from(user).where(eq(user.id, userId)).limit(1),
  );
  if (member?.role !== ROLE.member) {
    return yield* new RestorationUnavailable();
  }
  const [withdrawn] = yield* query((database) =>
    database.select().from(withdrawnMember).where(eq(withdrawnMember.email, member.email)).limit(1),
  );
  if (withdrawn === undefined || withdrawn.purgeAt.getTime() <= now.getTime()) {
    return yield* new RestorationUnavailable();
  }
  const snapshot = yield* decodeSnapshot(withdrawn.snapshot);
  const counterparts = [
    ...new Set(
      snapshot.follows.flatMap((edge) =>
        [edge.followerId, edge.followeeId].filter((id) => id !== withdrawn.id),
      ),
    ),
  ];
  const present =
    counterparts.length === 0
      ? []
      : yield* query((database) =>
          database.select({ id: user.id }).from(user).where(inArray(user.id, counterparts)),
        );
  const presentIds = new Set(present.map((row) => row.id));
  const versionIds = [...new Set(snapshot.acceptances.map((acceptance) => acceptance.versionId))];
  const liveVersions =
    versionIds.length === 0
      ? []
      : yield* query((database) =>
          database
            .select({ id: agreementVersion.id })
            .from(agreementVersion)
            .where(inArray(agreementVersion.id, versionIds)),
        );
  const liveVersionIds = new Set(liveVersions.map((version) => version.id));
  yield* query(async (database) => {
    await database.transaction(async (tx) => {
      await tx
        .update(user)
        .set({
          image: snapshot.image,
          name: snapshot.name,
          profile: snapshot.profile,
          socialLinks: snapshot.socialLinks,
          updatedAt: now,
        })
        .where(eq(user.id, member.id));
      await tx
        .update(memberMessage)
        .set({ senderId: member.id })
        .where(eq(memberMessage.senderId, withdrawn.id));
      for (const edge of snapshot.follows) {
        const followerId = edge.followerId === withdrawn.id ? member.id : edge.followerId;
        const followeeId = edge.followeeId === withdrawn.id ? member.id : edge.followeeId;
        const otherId = followerId === member.id ? followeeId : followerId;
        if (otherId === member.id || !presentIds.has(otherId)) {
          continue;
        }
        await tx
          .insert(follow)
          .values({ createdAt: new Date(edge.createdAt), followeeId, followerId })
          .onConflictDoNothing();
      }
      for (const acceptance of snapshot.acceptances) {
        if (!liveVersionIds.has(acceptance.versionId)) {
          continue;
        }
        await tx
          .insert(agreementAcceptance)
          .values({
            acceptedAt: new Date(acceptance.acceptedAt),
            userId: member.id,
            versionId: acceptance.versionId,
          })
          .onConflictDoNothing();
      }
      await tx
        .insert(memberOnboarding)
        .values({ step: snapshot.onboardingStep, updatedAt: now, userId: member.id })
        .onConflictDoUpdate({
          set: { step: snapshot.onboardingStep, updatedAt: now },
          target: memberOnboarding.userId,
        });
      await tx.delete(withdrawnMember).where(eq(withdrawnMember.id, withdrawn.id));
    });
  });
});

const purgeWithdrawnMembers = Effect.fn("purgeWithdrawnMembers")(function* purgeWithdrawnMembers(
  now: Date,
) {
  const removed = yield* query((database) =>
    database
      .delete(withdrawnMember)
      .where(lte(withdrawnMember.purgeAt, now))
      .returning({ id: withdrawnMember.id }),
  );
  return removed.length;
});

const listMemberMessages = Effect.fn("listMemberMessages")(function* listMemberMessages(
  recipientId: string,
) {
  const rows = yield* query((database) =>
    database
      .select({
        body: memberMessage.body,
        id: memberMessage.id,
        senderName: user.name,
      })
      .from(memberMessage)
      .leftJoin(user, eq(memberMessage.senderId, user.id))
      .where(eq(memberMessage.recipientId, recipientId))
      .orderBy(desc(memberMessage.createdAt), memberMessage.id),
  );
  return rows.map((row) => ({
    body: row.body,
    id: row.id,
    senderLabel: row.senderName ?? withdrawnMemberLabel,
  }));
});

export {
  EmailChangeUnavailable,
  LeaveUnavailable,
  RestorationUnavailable,
  confirmEmailChange,
  emailChangeLifetimeMs,
  leaveMember,
  listMemberMessages,
  purgeWithdrawnMembers,
  restorationFor,
  restoreMember,
  stageEmailChange,
  withdrawalRetentionMs,
  withdrawnMemberLabel,
};
