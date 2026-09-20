import { Schema } from "effect";

const onboardingSteps = ["agreement", "choose", "profile", "interview", "done"] as const;

const OnboardingStep = Schema.Literals(onboardingSteps);

const OnboardingView = Schema.Struct({
  step: OnboardingStep,
});

const OnboardingAdvance = Schema.Struct({
  step: OnboardingStep,
});

const FeedItem = Schema.Struct({
  actorId: Schema.String,
  actorName: Schema.String,
  kind: Schema.Literal("profile"),
  updatedAt: Schema.Number,
});

const HomeFeed = Schema.Struct({
  items: Schema.Array(FeedItem),
});

export { FeedItem, HomeFeed, OnboardingAdvance, OnboardingStep, OnboardingView };
