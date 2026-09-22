import { onboardingSteps } from "@repo/db";
import { Schema } from "effect";

const OnboardingStep = Schema.Literals(onboardingSteps);
type OnboardingStep = typeof OnboardingStep.Type;

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
  profile: Schema.String,
  updatedAt: Schema.Finite,
});
type FeedItem = typeof FeedItem.Type;

const HomeFeed = Schema.Struct({
  items: Schema.Array(FeedItem),
});

export { FeedItem, HomeFeed, OnboardingAdvance, OnboardingStep, OnboardingView };
