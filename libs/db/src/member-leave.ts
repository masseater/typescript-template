import { ROLE, memberRetentionDays } from "@repo/config";
import { and, desc, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { DateTime, Effect, Schema } from "effect";

import { agreementAcceptance, agreementVersion } from "./agreement-schema.ts";
import { query } from "./database.ts";
import { interview } from "./interview-schema.ts";
import { leaveRequest, withdrawnMember } from "./member-leave-schema.ts";
import { follow, memberOnboarding, onboardingSteps } from "./member-social-schema.ts";
import { user } from "./schema.ts";
import { revokeUserSessions } from "./security.ts";
import { UserNotFound } from "./user-not-found.ts";

const retentionMilliseconds = memberRetentionDays * 24 * 60 * 60 * 1000;

const MemberSnapshot = Schema.Struct({
  agreements: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        acceptedAt: Schema.Finite,
        versionId: Schema.String,
      }),
    ),
  ),
  followers: Schema.Array(Schema.String),
  following: Schema.Array(Schema.String),
  interview: Schema.optionalKey(
    Schema.Struct({
      day: Schema.String,
      savedSheet: Schema.Unknown,
      state: Schema.Unknown,
      turns: Schema.Finite,
      updatedAt: Schema.Finite,
      version: Schema.Finite,
    }),
  ),
  onboarding: Schema.optionalKey(
    Schema.Struct({
      step: Schema.Literals(onboardingSteps),
      updatedAt: Schema.Finite,
    }),
  ),
});

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
  const agreements = yield* query((database) =>
    database
      .select({
        acceptedAt: agreementAcceptance.acceptedAt,
        versionId: agreementAcceptance.versionId,
      })
      .from(agreementAcceptance)
      .where(eq(agreementAcceptance.userId, memberId)),
  );
  const snapshot: typeof MemberSnapshot.Type = {
    agreements: agreements.map((row) => ({
      acceptedAt: row.acceptedAt.getTime(),
      versionId: row.versionId,
    })),
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
  snapshot: typeof MemberSnapshot.Type,
) {
  const now = DateTime.toDate(yield* DateTime.now);
  const onboarding = snapshot.onboarding;
  if (onboarding !== undefined) {
    const onboardingUpdatedAt = DateTime.toDate(DateTime.makeUnsafe(onboarding.updatedAt));
    yield* query((database) =>
      database
        .insert(memberOnboarding)
        .values({
          step: onboarding.step,
          updatedAt: onboardingUpdatedAt,
          userId: memberId,
        })
        .onConflictDoUpdate({
          set: { step: onboarding.step, updatedAt: onboardingUpdatedAt },
          target: memberOnboarding.userId,
        }),
    );
  }
  const savedInterview = snapshot.interview;
  if (savedInterview !== undefined) {
    const interviewUpdatedAt = DateTime.toDate(DateTime.makeUnsafe(savedInterview.updatedAt));
    yield* query((database) =>
      database
        .insert(interview)
        .values({
          day: savedInterview.day,
          savedSheet: savedInterview.savedSheet,
          state: savedInterview.state,
          turns: savedInterview.turns,
          updatedAt: interviewUpdatedAt,
          userId: memberId,
          version: savedInterview.version,
        })
        .onConflictDoUpdate({
          set: {
            day: savedInterview.day,
            savedSheet: savedInterview.savedSheet,
            state: savedInterview.state,
            turns: savedInterview.turns,
            updatedAt: interviewUpdatedAt,
            version: savedInterview.version,
          },
          target: interview.userId,
        }),
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
  const keptAgreements = snapshot.agreements ?? [];
  if (keptAgreements.length === 0) {
    return;
  }
  const versionIds = keptAgreements.map((row) => row.versionId);
  const surviving = yield* query((database) =>
    database
      .select({ id: agreementVersion.id })
      .from(agreementVersion)
      .where(inArray(agreementVersion.id, versionIds)),
  );
  const liveVersions = new Set(surviving.map((row) => row.id));
  const acceptanceRows = keptAgreements
    .filter((row) => liveVersions.has(row.versionId))
    .map((row) => ({
      acceptedAt: DateTime.toDate(DateTime.makeUnsafe(row.acceptedAt)),
      userId: memberId,
      versionId: row.versionId,
    }));
  if (acceptanceRows.length > 0) {
    yield* query((database) =>
      database.insert(agreementAcceptance).values(acceptanceRows).onConflictDoNothing(),
    );
  }
});

const findRecoveryOffer = Effect.fn("findRecoveryOffer")(function* findRecoveryOffer(
  memberId: string,
) {
  const checkedAt = DateTime.toDate(yield* DateTime.now);
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
      .orderBy(desc(withdrawnMember.withdrawnAt))
      .limit(1),
  );
  if (pending === undefined) {
    return { available: false as const };
  }
  return { available: true as const, previousName: pending.name };
});

const acceptRecovery = Effect.fn("acceptRecovery")(function* acceptRecovery(memberId: string) {
  const checkedAt = DateTime.toDate(yield* DateTime.now);
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
      .orderBy(desc(withdrawnMember.withdrawnAt))
      .limit(1),
  );
  if (pending === undefined) {
    return yield* new RecoveryExpired();
  }
  const { withdrawn } = pending;
  const snapshot = yield* Schema.decodeUnknownEffect(MemberSnapshot)(withdrawn.snapshot).pipe(
    Effect.tapError(() => Effect.log(`member_leave.snapshot_invalid member=${withdrawn.memberId}`)),
    Effect.mapError(() => new RecoveryUnavailable()),
  );
  const restoredAt = DateTime.toDate(yield* DateTime.now);
  yield* query((database) =>
    database
      .update(user)
      .set({
        image: withdrawn.image,
        name: withdrawn.name,
        profile: withdrawn.profile,
        socialLinks: withdrawn.socialLinks,
        updatedAt: restoredAt,
      })
      .where(eq(user.id, memberId))
      .then(() => undefined),
  );
  yield* restoreSnapshot(memberId, snapshot);
  yield* query((database) =>
    database
      .batch([
        database
          .update(leaveRequest)
          .set({ restoredAt })
          .where(eq(leaveRequest.memberId, withdrawn.memberId)),
        database.delete(withdrawnMember).where(eq(withdrawnMember.memberId, withdrawn.memberId)),
      ])
      .then(() => undefined),
  );
  return { memberId, restoredAt };
});

const declineRecovery = Effect.fn("declineRecovery")(function* declineRecovery(memberId: string) {
  const checkedAt = DateTime.toDate(yield* DateTime.now);
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
      .orderBy(desc(withdrawnMember.withdrawnAt))
      .limit(1),
  );
  if (pending === undefined) {
    return yield* new RecoveryExpired();
  }
  const declinedAt = DateTime.toDate(yield* DateTime.now);
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
  const withdrawnAt = DateTime.toDate(yield* DateTime.now);
  const purgeAt = DateTime.toDate(DateTime.makeUnsafe(withdrawnAt.getTime() + retentionMilliseconds));
  const snapshot = yield* loadSnapshot(memberId);
  yield* query((database) =>
    database
      .batch([
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
      ])
      .then(() => undefined),
  );
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
    yield* query((database) =>
      database
        .batch([
          database.delete(leaveRequest).where(inArray(leaveRequest.memberId, memberIds)),
          database.delete(withdrawnMember).where(inArray(withdrawnMember.memberId, memberIds)),
        ])
        .then(() => undefined),
    );
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
  withdrawMember,
};
