import { ROLE } from "@repo/config";
import {
  NOTIFICATION_KIND,
  UserNotFound,
  and,
  desc,
  eq,
  inArray,
  onboardingSteps,
  or,
  pairBlocked,
  profileVisibleTo,
  query,
  schema,
} from "@repo/db";
import { DateTime, Effect } from "effect";

import { FollowSelfForbidden } from "./follow-self-forbidden.ts";
import { notify } from "./notifications.ts";

const { follow, memberOnboarding, user } = schema;

type OnboardingStep = (typeof onboardingSteps)[number];

const memberVisible = (viewerId: string) => or(eq(user.emailVerified, true), eq(user.id, viewerId));

const stepOf = Effect.fn("onboardingStep")(function* onboardingStep(userId: string) {
  const [row] = yield* query((database) =>
    database
      .select({ step: memberOnboarding.step })
      .from(memberOnboarding)
      .where(eq(memberOnboarding.userId, userId))
      .limit(1),
  );
  return row?.step ?? ("agreement" satisfies OnboardingStep);
});

const advanceOnboarding = Effect.fn("advanceOnboarding")(function* advanceOnboarding(
  userId: string,
  step: OnboardingStep,
) {
  const now = DateTime.toDate(yield* DateTime.now);
  yield* query((database) =>
    database
      .insert(memberOnboarding)
      .values({ step, updatedAt: now, userId })
      .onConflictDoUpdate({
        set: { step, updatedAt: now },
        target: memberOnboarding.userId,
      }),
  );
});

interface FeedItem {
  readonly actorId: string;
  readonly actorName: string;
  readonly kind: "profile";
  readonly profile: string;
  readonly updatedAt: number;
}

const homeFeed = Effect.fn("homeFeed")(function* homeFeed(viewerId: string) {
  const followees = yield* query((database) =>
    database
      .select({ followeeId: follow.followeeId })
      .from(follow)
      .where(eq(follow.followerId, viewerId)),
  );
  const ids = followees.map((row) => row.followeeId);
  if (ids.length === 0) {
    return [] as readonly FeedItem[];
  }
  const actors = yield* query((database) =>
    database
      .select({
        id: user.id,
        name: user.name,
        profile: user.profile,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .where(and(inArray(user.id, ids), profileVisibleTo(viewerId)))
      .orderBy(desc(user.updatedAt))
      .limit(50),
  );
  return actors.map((actor): FeedItem => ({
    actorId: actor.id,
    actorName: actor.name,
    kind: "profile",
    profile: actor.profile,
    updatedAt: actor.updatedAt.getTime(),
  }));
});

const followMember = Effect.fn("followMember")(function* followMember(
  followerId: string,
  followeeId: string,
) {
  if (followerId === followeeId) {
    return yield* new FollowSelfForbidden();
  }
  const [followee] = yield* query((database) =>
    database
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, followeeId), eq(user.role, ROLE.member), memberVisible(followerId)))
      .limit(1),
  );
  if (followee === undefined) {
    return yield* new UserNotFound();
  }
  const [follower] = yield* query((database) =>
    database.select({ name: user.name }).from(user).where(eq(user.id, followerId)).limit(1),
  );
  if (follower === undefined) {
    return yield* new UserNotFound();
  }
  if (yield* pairBlocked(followerId, followeeId)) {
    return yield* new UserNotFound();
  }
  const now = new Date();
  const inserted = yield* query((database) =>
    database
      .insert(follow)
      .values({ createdAt: now, followeeId, followerId })
      .onConflictDoNothing()
      .returning({ followeeId: follow.followeeId }),
  );
  if (inserted.length > 0) {
    yield* notify({
      actorId: followerId,
      actorName: follower.name,
      kind: NOTIFICATION_KIND.follow,
      recipientId: followeeId,
      subjectId: followerId,
    });
  }
});

const unfollowMember = Effect.fn("unfollowMember")(function* unfollowMember(
  followerId: string,
  followeeId: string,
) {
  yield* query((database) =>
    database
      .delete(follow)
      .where(and(eq(follow.followerId, followerId), eq(follow.followeeId, followeeId))),
  );
});

const isFollowing = Effect.fn("isFollowing")(function* following(
  followerId: string,
  followeeId: string,
) {
  const [row] = yield* query((database) =>
    database
      .select({ followeeId: follow.followeeId })
      .from(follow)
      .where(and(eq(follow.followerId, followerId), eq(follow.followeeId, followeeId)))
      .limit(1),
  );
  return row !== undefined;
});

const listFollowers = Effect.fn("listFollowers")(function* listFollowers(
  viewerId: string,
  memberId: string,
) {
  const rows = yield* query((database) =>
    database
      .select({ followerId: follow.followerId, name: user.name })
      .from(follow)
      .innerJoin(user, eq(user.id, follow.followerId))
      .where(
        and(eq(follow.followeeId, memberId), eq(user.role, ROLE.member), memberVisible(viewerId)),
      )
      .orderBy(desc(follow.createdAt), follow.followerId),
  );
  return rows.map((row) => ({ id: row.followerId, name: row.name }));
});

const listFollowing = Effect.fn("listFollowing")(function* listFollowing(
  viewerId: string,
  memberId: string,
) {
  const rows = yield* query((database) =>
    database
      .select({ followeeId: follow.followeeId, name: user.name })
      .from(follow)
      .innerJoin(user, eq(user.id, follow.followeeId))
      .where(
        and(eq(follow.followerId, memberId), eq(user.role, ROLE.member), memberVisible(viewerId)),
      )
      .orderBy(desc(follow.createdAt), follow.followeeId),
  );
  return rows.map((row) => ({ id: row.followeeId, name: row.name }));
});

export {
  advanceOnboarding,
  followMember,
  homeFeed,
  isFollowing,
  listFollowers,
  listFollowing,
  stepOf,
  unfollowMember,
};
