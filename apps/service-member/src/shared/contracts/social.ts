import { Schema } from "effect";

const OnboardingStep = Schema.Literals([
  "agreement",
  "choose",
  "profile",
  "interview",
  "done",
] as const);

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
  updatedAt: Schema.Number,
});

const HomeFeed = Schema.Struct({
  items: Schema.Array(FeedItem),
});

type OnboardingStep = typeof OnboardingStep.Type;
type OnboardingView = typeof OnboardingView.Type;
type OnboardingAdvance = typeof OnboardingAdvance.Type;
type FeedItem = typeof FeedItem.Type;
type HomeFeed = typeof HomeFeed.Type;

export { FeedItem, HomeFeed, OnboardingAdvance, OnboardingStep, OnboardingView };
