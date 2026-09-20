import { ROLE } from "@repo/config";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";

import { query } from "./database.ts";
import { follow, memberOnboarding, onboardingSteps } from "./member-social-schema.ts";
import { user } from "./schema.ts";

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
  const now = new Date();
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

const followMember = Effect.fn("followMember")(function* followMember(
  followerId: string,
  followeeId: string,
) {
  if (followerId === followeeId) {
    return;
  }
  yield* query((database) =>
    database
      .insert(follow)
      .values({ createdAt: new Date(), followeeId, followerId })
      .onConflictDoNothing(),
  );
});

interface FeedItem {
  readonly actorId: string;
  readonly actorName: string;
  readonly kind: "profile";
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
    updatedAt: actor.updatedAt.getTime(),
  }));
});

export { advanceOnboarding, followMember, homeFeed, onboardingSteps, stepOf };
export type { FeedItem, OnboardingStep };
