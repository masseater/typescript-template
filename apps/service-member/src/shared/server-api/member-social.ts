import { ROLE } from "@repo/config/identity";
import { and, desc, eq, inArray, onboardingSteps, query, schema } from "@repo/db";
import { DateTime, Effect } from "effect";

const { follow, memberOnboarding, user } = schema;

type OnboardingStep = (typeof onboardingSteps)[number];

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
      .where(and(inArray(user.id, ids), eq(user.role, ROLE.member), eq(user.emailVerified, true)))
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

export { advanceOnboarding, homeFeed, stepOf };
