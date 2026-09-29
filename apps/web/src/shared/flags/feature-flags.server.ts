import { InMemoryProvider, OpenFeature } from "@openfeature/server-sdk";
import { Context, Effect, Layer } from "effect";

import { flagConfiguration } from "./flag-configuration";

export class FeatureFlags extends Context.Service<
  FeatureFlags,
  {
    readonly getBoolean: (key: string, defaultValue: boolean) => Effect.Effect<boolean>;
  }
>()("FeatureFlags") {}

export const featureFlagsLive = Layer.effect(
  FeatureFlags,
  Effect.gen(function* () {
    yield* Effect.promise(() =>
      OpenFeature.setProviderAndWait(new InMemoryProvider(flagConfiguration)),
    );
    const client = OpenFeature.getClient();
    return FeatureFlags.of({
      getBoolean: (key, defaultValue) =>
        Effect.promise(() => client.getBooleanValue(key, defaultValue)),
    });
  }),
);
