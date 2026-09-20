import { ROLE } from "@repo/config";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { query } from "./database.ts";
import { interview } from "./interview-schema.ts";
import { leaveRequest, withdrawnMember } from "./member-leave-schema.ts";
import { follow, memberOnboarding } from "./member-social-schema.ts";
import { user } from "./schema.ts";
import { revokeUserSessions } from "./security.ts";
import { UserNotFound } from "./user-not-found.ts";

const retentionDays = 30;
const retentionMilliseconds = retentionDays * 24 * 60 * 60 * 1000;

type MemberSnapshot = Readonly<{
  followers: readonly string[];
  following: readonly string[];
  interview?: Readonly<{
    day: string;
    savedSheet: unknown;
    state: unknown;
    turns: number;
    updatedAt: number;
    version: number;
  }>;
  onboarding?: Readonly<{
    step: string;
    updatedAt: number;
  }>;
}>;

class MemberLeaveUnavailable extends Schema.TaggedError<MemberLeaveUnavailable>()(
  "MemberLeaveUnavailable",
  {},
) {}

class RecoveryExpired extends Schema.TaggedError<RecoveryExpired>()("RecoveryExpired", {}) {}

class RecoveryUnavailable extends Schema.TaggedError<RecoveryUnavailable>()(
  "RecoveryUnavailable",
  {},
) {}

const pendingRecovery = (email: string, checkedAt: Date) =>
  and(
    eq(withdrawnMember.email, email),
    gt(leaveRequest.purgeAt, checkedAt),
    isNull(leaveRequest.restoredAt),
    isNull(leaveRequest.recoveryDeclinedAt),
  );

const loadSnapshot = Effect.fn("loadMemberSnapshot")(function* loadSnapshot(memberId: string) {
  const [onboarding] = yield* query((database) =>
    database
      .select({ step: memberOnboarding.step, updatedAt: memberOnboarding.updatedAt })
      .from(memberOnboarding)
      .where(eq(memberOnboarding.userId, memberId))
      .limit(1),
  );
  const [savedInterview] = yield* query((database) =>
    database.select().from(interview).where(eq(interview.userId, memberId)).limit(1),
  );
  const following = yield* query((database) =>
    database
      .select({ followeeId: follow.followeeId })
      .from(follow)
      .where(eq(follow.followerId, memberId)),
  );
  const followers = yield* query((database) =>
    database
      .select({ followerId: follow.followerId })
      .from(follow)
      .where(eq(follow.followeeId, memberId)),
  );
  const snapshot: MemberSnapshot = {
    followers: followers.map((row) => row.followerId),
    following: following.map((row) => row.followeeId),
    ...(onboarding === undefined
      ? {}
      : { onboarding: { step: onboarding.step, updatedAt: onboarding.updatedAt.getTime() } }),
    ...(savedInterview === undefined
      ? {}
      : {
          interview: {
            day: savedInterview.day,
            savedSheet: savedInterview.savedSheet,
            state: savedInterview.state,
            turns: savedInterview.turns,
            updatedAt: savedInterview.updatedAt.getTime(),
            version: savedInterview.version,
          },
        }),
  };
  return snapshot;
});

const restoreSnapshot = Effect.fn("restoreMemberSnapshot")(function* restoreSnapshot(
  memberId: string,
  snapshot: MemberSnapshot,
) {
  const now = new Date();
  if (snapshot.onboarding !== undefined) {
    yield* query((database) =>
      database
        .insert(memberOnboarding)
        .values({
          step: snapshot.onboarding.step as (typeof memberOnboarding.$inferInsert)["step"],
          updatedAt: new Date(snapshot.onboarding.updatedAt),
          userId: memberId,
        })
        .onConflictDoNothing(),
    );
  }
  if (snapshot.interview !== undefined) {
    yield* query((database) =>
      database
        .insert(interview)
        .values({
          day: snapshot.interview.day,
          savedSheet: snapshot.interview.savedSheet,
          state: snapshot.interview.state,
          turns: snapshot.interview.turns,
          updatedAt: new Date(snapshot.interview.updatedAt),
          userId: memberId,
          version: snapshot.interview.version,
        })
        .onConflictDoNothing(),
    );
  }
  const followRows = [
    ...snapshot.following.map((followeeId) => ({
      createdAt: now,
      followeeId,
      followerId: memberId,
    })),
    ...snapshot.followers.map((followerId) => ({
      createdAt: now,
      followeeId: memberId,
      followerId,
    })),
  ];
  if (followRows.length > 0) {
    yield* query((database) => database.insert(follow).values(followRows).onConflictDoNothing());
  }
});

const findRecoveryOffer = Effect.fn("findRecoveryOffer")(function* findRecoveryOffer(
  memberId: string,
) {
  const checkedAt = new Date();
  const [member] = yield* query((database) =>
    database
      .select({ email: user.email, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, memberId))
      .limit(1),
  );
  if (member === undefined || !member.emailVerified) {
    return { available: false as const };
  }
  const [pending] = yield* query((database) =>
    database
      .select({ name: withdrawnMember.name })
      .from(withdrawnMember)
      .innerJoin(leaveRequest, eq(leaveRequest.memberId, withdrawnMember.memberId))
      .where(pendingRecovery(member.email, checkedAt))
      .limit(1),
  );
  if (pending === undefined) {
    return { available: false as const };
  }
  return { available: true as const, previousName: pending.name };
});

const acceptRecovery = Effect.fn("acceptRecovery")(function* acceptRecovery(memberId: string) {
  const checkedAt = new Date();
  const [member] = yield* query((database) =>
    database
      .select({
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
      })
      .from(user)
      .where(eq(user.id, memberId))
      .limit(1),
  );
  if (member === undefined) {
    return yield* new UserNotFound();
  }
  if (!member.emailVerified || member.role !== ROLE.member) {
    return yield* new RecoveryUnavailable();
  }
  const [pending] = yield* query((database) =>
    database
      .select({ leave: leaveRequest, withdrawn: withdrawnMember })
      .from(withdrawnMember)
      .innerJoin(leaveRequest, eq(leaveRequest.memberId, withdrawnMember.memberId))
      .where(pendingRecovery(member.email, checkedAt))
      .limit(1),
  );
  if (pending === undefined) {
    return yield* new RecoveryExpired();
  }
  const { withdrawn } = pending;
  const restoredAt = new Date();
  yield* query(async (database) => {
    await database
      .update(user)
      .set({
        image: withdrawn.image,
        name: withdrawn.name,
        profile: withdrawn.profile,
        socialLinks: withdrawn.socialLinks,
        updatedAt: restoredAt,
      })
      .where(eq(user.id, memberId));
  });
  yield* restoreSnapshot(memberId, withdrawn.snapshot as MemberSnapshot);
  yield* query(async (database) => {
    await database.batch([
      database
        .update(leaveRequest)
        .set({ restoredAt })
        .where(eq(leaveRequest.memberId, withdrawn.memberId)),
      database.delete(withdrawnMember).where(eq(withdrawnMember.memberId, withdrawn.memberId)),
    ]);
  });
  return { memberId, restoredAt };
});

const declineRecovery = Effect.fn("declineRecovery")(function* declineRecovery(memberId: string) {
  const checkedAt = new Date();
  const [member] = yield* query((database) =>
    database
      .select({ email: user.email, emailVerified: user.emailVerified, role: user.role })
      .from(user)
      .where(eq(user.id, memberId))
      .limit(1),
  );
  if (member === undefined) {
    return yield* new UserNotFound();
  }
  if (!member.emailVerified || member.role !== ROLE.member) {
    return yield* new RecoveryUnavailable();
  }
  const [pending] = yield* query((database) =>
    database
      .select({ memberId: withdrawnMember.memberId })
      .from(withdrawnMember)
      .innerJoin(leaveRequest, eq(leaveRequest.memberId, withdrawnMember.memberId))
      .where(pendingRecovery(member.email, checkedAt))
      .limit(1),
  );
  if (pending === undefined) {
    return yield* new RecoveryExpired();
  }
  const declinedAt = new Date();
  yield* query((database) =>
    database
      .update(leaveRequest)
      .set({ recoveryDeclinedAt: declinedAt })
      .where(eq(leaveRequest.memberId, pending.memberId)),
  );
  return { declinedAt };
});

const withdrawMember = Effect.fn("withdrawMember")(function* withdrawMember(
  memberId: string,
  options: Readonly<{ immediate: boolean }>,
) {
  const [member] = yield* query((database) =>
    database.select().from(user).where(eq(user.id, memberId)).limit(1),
  );
  if (member === undefined) {
    return yield* new UserNotFound();
  }
  if (member.role !== ROLE.member) {
    return yield* new MemberLeaveUnavailable();
  }
  yield* revokeUserSessions(memberId);
  if (options.immediate) {
    yield* query((database) => database.delete(user).where(eq(user.id, memberId)));
    return { immediate: true as const };
  }
  const withdrawnAt = new Date();
  const purgeAt = new Date(withdrawnAt.getTime() + retentionMilliseconds);
  const snapshot = yield* loadSnapshot(memberId);
  yield* query(async (database) => {
    await database.batch([
      database.insert(withdrawnMember).values({
        createdAt: member.createdAt,
        email: member.email,
        emailVerified: member.emailVerified,
        image: member.image,
        memberId,
        name: member.name,
        profile: member.profile,
        securityVersion: member.securityVersion,
        snapshot,
        socialLinks: member.socialLinks,
        twoFactorEnabled: member.twoFactorEnabled,
        withdrawnAt,
      }),
      database.insert(leaveRequest).values({
        memberId,
        purgeAt,
        requestedAt: withdrawnAt,
      }),
      database.delete(user).where(eq(user.id, memberId)),
    ]);
  });
  return { immediate: false as const, purgeAt };
});

const purgeExpiredWithdrawnMembers = Effect.fn("purgeExpiredWithdrawnMembers")(
  function* purgeExpiredWithdrawnMembers(checkedAt: Date) {
    const expired = yield* query((database) =>
      database
        .select({ memberId: leaveRequest.memberId })
        .from(leaveRequest)
        .where(and(lte(leaveRequest.purgeAt, checkedAt), isNull(leaveRequest.restoredAt))),
    );
    const memberIds = expired.map((row) => row.memberId);
    if (memberIds.length === 0) {
      return { count: 0, memberIds: [] as readonly string[] };
    }
    yield* query(async (database) => {
      await database.batch([
        database.delete(leaveRequest).where(inArray(leaveRequest.memberId, memberIds)),
        database.delete(withdrawnMember).where(inArray(withdrawnMember.memberId, memberIds)),
      ]);
    });
    return { count: memberIds.length, memberIds };
  },
);

export {
  MemberLeaveUnavailable,
  RecoveryExpired,
  RecoveryUnavailable,
  acceptRecovery,
  declineRecovery,
  findRecoveryOffer,
  purgeExpiredWithdrawnMembers,
  retentionDays,
  withdrawMember,
};
