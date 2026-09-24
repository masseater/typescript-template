import { ROLE, memberRetentionDays } from "@repo/config";
import { logAt, logCause } from "@repo/observability";
import { and, desc, eq, gt, inArray, isNull, lte, type SQL } from "drizzle-orm";
import { DateTime, Effect, Schema, type Cause } from "effect";

import { agreementAcceptance, agreementVersion } from "./agreement-schema.ts";
import { query } from "./database.ts";
import { interview } from "./interview-schema.ts";
import { leaveRequest, withdrawnMember } from "./member-leave-schema.ts";
import { MemberLeaveUnavailable } from "./member-leave-unavailable.ts";
import { follow, memberOnboarding, onboardingSteps } from "./member-social-schema.ts";
import { RecoveryExpired } from "./recovery-expired.ts";
import { RecoveryUnavailable } from "./recovery-unavailable.ts";
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

const pendingRecovery = (email: string, checkedAt: Date): SQL | undefined =>
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
    agreements: agreements.map((acceptance) => ({
      acceptedAt: acceptance.acceptedAt.getTime(),
      versionId: acceptance.versionId,
    })),
    followers: followers.map((followedBy) => followedBy.followerId),
    following: following.map((followed) => followed.followeeId),
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

const restoreOnboarding = Effect.fn("restoreMemberOnboarding")(function* restoreOnboarding(
  memberId: string,
  onboarding: NonNullable<(typeof MemberSnapshot.Type)["onboarding"]>,
) {
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
});

const restoreInterview = Effect.fn("restoreMemberInterview")(function* restoreInterview(
  memberId: string,
  savedInterview: NonNullable<(typeof MemberSnapshot.Type)["interview"]>,
) {
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
});

const restoreFollows = Effect.fn("restoreMemberFollows")(function* restoreFollows(
  memberId: string,
  snapshot: typeof MemberSnapshot.Type,
) {
  const followedAt = DateTime.toDate(yield* DateTime.now);
  const followRows = [
    ...snapshot.following.map((followeeId) => ({
      createdAt: followedAt,
      followeeId,
      followerId: memberId,
    })),
    ...snapshot.followers.map((followerId) => ({
      createdAt: followedAt,
      followeeId: memberId,
      followerId,
    })),
  ];
  if (followRows.length > 0) {
    yield* query((database) => database.insert(follow).values(followRows).onConflictDoNothing());
  }
});

const restoreAgreements = Effect.fn("restoreMemberAgreements")(function* restoreAgreements(
  memberId: string,
  keptAgreements: NonNullable<(typeof MemberSnapshot.Type)["agreements"]>,
) {
  if (keptAgreements.length === 0) {
    return;
  }
  const versionIds = keptAgreements.map((acceptance) => acceptance.versionId);
  const surviving = yield* query((database) =>
    database
      .select({ id: agreementVersion.id })
      .from(agreementVersion)
      .where(inArray(agreementVersion.id, versionIds)),
  );
  const liveVersions = new Set(surviving.map((version) => version.id));
  const acceptanceRows = keptAgreements
    .filter((acceptance) => liveVersions.has(acceptance.versionId))
    .map((acceptance) => ({
      acceptedAt: DateTime.toDate(DateTime.makeUnsafe(acceptance.acceptedAt)),
      userId: memberId,
      versionId: acceptance.versionId,
    }));
  if (acceptanceRows.length > 0) {
    yield* query((database) =>
      database.insert(agreementAcceptance).values(acceptanceRows).onConflictDoNothing(),
    );
  }
});

const restoreSnapshot = Effect.fn("restoreMemberSnapshot")(function* restoreSnapshot(
  memberId: string,
  snapshot: typeof MemberSnapshot.Type,
) {
  if (snapshot.onboarding !== undefined) {
    yield* restoreOnboarding(memberId, snapshot.onboarding);
  }
  if (snapshot.interview !== undefined) {
    yield* restoreInterview(memberId, snapshot.interview);
  }
  yield* restoreFollows(memberId, snapshot);
  yield* restoreAgreements(memberId, snapshot.agreements ?? []);
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

const recoverableEmail = Effect.fn("recoverableEmail")(function* recoverableEmail(
  memberId: string,
) {
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
  return member.email;
});

const decodeSnapshot = (
  withdrawn: typeof withdrawnMember.$inferSelect,
): Effect.Effect<typeof MemberSnapshot.Type, RecoveryUnavailable> =>
  Schema.decodeUnknownEffect(MemberSnapshot)(withdrawn.snapshot).pipe(
    Effect.tapError(() =>
      logAt("Info", {
        attributes: { memberId: withdrawn.memberId },
        eventName: "member_leave.snapshot_invalid",
      }),
    ),
    Effect.mapError(() => new RecoveryUnavailable()),
  );

const restoreWithdrawn = Effect.fn("restoreWithdrawnMember")(function* restoreWithdrawn(
  memberId: string,
  restoration: {
    readonly restoredAt: Date;
    readonly snapshot: typeof MemberSnapshot.Type;
    readonly withdrawn: typeof withdrawnMember.$inferSelect;
  },
) {
  const { restoredAt, withdrawn } = restoration;
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
      .where(eq(user.id, memberId)),
  );
  yield* restoreSnapshot(memberId, restoration.snapshot);
  yield* query((database) =>
    database.batch([
      database
        .update(leaveRequest)
        .set({ restoredAt })
        .where(eq(leaveRequest.memberId, withdrawn.memberId)),
      database.delete(withdrawnMember).where(eq(withdrawnMember.memberId, withdrawn.memberId)),
    ]),
  );
});

const pendingWithdrawal = Effect.fn("pendingWithdrawal")(function* pendingWithdrawal(
  memberId: string,
) {
  const checkedAt = DateTime.toDate(yield* DateTime.now);
  const email = yield* recoverableEmail(memberId);
  const [pending] = yield* query((database) =>
    database
      .select({ leave: leaveRequest, withdrawn: withdrawnMember })
      .from(withdrawnMember)
      .innerJoin(leaveRequest, eq(leaveRequest.memberId, withdrawnMember.memberId))
      .where(pendingRecovery(email, checkedAt))
      .orderBy(desc(withdrawnMember.withdrawnAt))
      .limit(1),
  );
  if (pending === undefined) {
    return yield* new RecoveryExpired();
  }
  return pending;
});

const acceptRecovery = Effect.fn("acceptRecovery")(function* acceptRecovery(memberId: string) {
  const pending = yield* pendingWithdrawal(memberId);
  const snapshot = yield* decodeSnapshot(pending.withdrawn);
  const restoredAt = DateTime.toDate(yield* DateTime.now);
  yield* restoreWithdrawn(memberId, { restoredAt, snapshot, withdrawn: pending.withdrawn });
  return { memberId, restoredAt };
});

const declineRecovery = Effect.fn("declineRecovery")(function* declineRecovery(memberId: string) {
  const pending = yield* pendingWithdrawal(memberId);
  const declinedAt = DateTime.toDate(yield* DateTime.now);
  yield* query((database) =>
    database
      .update(leaveRequest)
      .set({ recoveryDeclinedAt: declinedAt })
      .where(eq(leaveRequest.memberId, pending.withdrawn.memberId)),
  );
  return { declinedAt };
});

const withdrawableMember = Effect.fn("withdrawableMember")(function* withdrawableMember(
  memberId: string,
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
  return member;
});

const retainWithdrawn = Effect.fn("retainWithdrawnMember")(function* retainWithdrawn(
  member: typeof user.$inferSelect,
) {
  const memberId = member.id;
  const withdrawnAt = DateTime.toDate(yield* DateTime.now);
  const purgeAt = DateTime.toDate(
    DateTime.makeUnsafe(withdrawnAt.getTime() + retentionMilliseconds),
  );
  const snapshot = yield* loadSnapshot(memberId);
  yield* query((database) =>
    database.batch([
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
    ]),
  );
  return purgeAt;
});

type PhotoRemover<Failure, Requirements> = (
  memberId: string,
) => Effect.Effect<void, Failure, Requirements>;

const photoPurgeFailed =
  (memberId: string): ((cause: Cause.Cause<unknown>) => Effect.Effect<void>) =>
  (cause: Cause.Cause<unknown>): Effect.Effect<void> =>
    logCause({ attributes: { memberId }, cause, eventName: "member_leave.photo_purge_failed" });

const withdrawMember = Effect.fn("withdrawMember")(function* withdrawMember<Failure, Requirements>(
  memberId: string,
  leave: Readonly<{ immediate: boolean; removePhotos: PhotoRemover<Failure, Requirements> }>,
) {
  const member = yield* withdrawableMember(memberId);
  if (leave.immediate) {
    yield* leave.removePhotos(memberId);
    yield* revokeUserSessions(memberId);
    yield* query((database) => database.delete(user).where(eq(user.id, memberId)));
    return { immediate: true as const };
  }
  yield* revokeUserSessions(memberId);
  const purgeAt = yield* retainWithdrawn(member);
  yield* leave
    .removePhotos(memberId)
    .pipe(Effect.tapCause(photoPurgeFailed(memberId)), Effect.ignore);
  return { immediate: false as const, purgeAt };
});

const releasePhotos = <Failure, Requirements>(
  memberIds: readonly string[],
  removePhotos: PhotoRemover<Failure, Requirements>,
): Effect.Effect<readonly string[], never, Requirements> =>
  Effect.forEach(memberIds, (memberId) =>
    removePhotos(memberId).pipe(
      Effect.as(memberId),
      Effect.tapCause(photoPurgeFailed(memberId)),
      Effect.orElseSucceed(() => undefined),
    ),
  ).pipe(Effect.map((released) => released.filter((memberId) => memberId !== undefined)));

const purgeExpiredWithdrawnMembers = Effect.fn("purgeExpiredWithdrawnMembers")(
  function* purgeExpiredWithdrawnMembers<Failure, Requirements>(
    checkedAt: Date,
    removePhotos: PhotoRemover<Failure, Requirements>,
  ) {
    const expired = yield* query((database) =>
      database
        .select({ memberId: leaveRequest.memberId })
        .from(leaveRequest)
        .where(and(lte(leaveRequest.purgeAt, checkedAt), isNull(leaveRequest.restoredAt))),
    );
    const expiredIds = expired.map((expiredLeave) => expiredLeave.memberId);
    const memberIds = yield* releasePhotos(expiredIds, removePhotos);
    if (memberIds.length > 0) {
      yield* query((database) =>
        database.batch([
          database.delete(leaveRequest).where(inArray(leaveRequest.memberId, memberIds)),
          database.delete(withdrawnMember).where(inArray(withdrawnMember.memberId, memberIds)),
        ]),
      );
    }
    const released = new Set(memberIds);
    return {
      memberIds,
      retainedMemberIds: expiredIds.filter((memberId) => !released.has(memberId)),
    };
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
