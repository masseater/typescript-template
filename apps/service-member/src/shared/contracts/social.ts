import { Schema } from "effect";

const OnboardingStep = Schema.Literals([
  "agreement",
  "choose",
  "profile",
  "interview",
  "done",
]);

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

export { FeedItem, HomeFeed, OnboardingAdvance, OnboardingStep, OnboardingView };
