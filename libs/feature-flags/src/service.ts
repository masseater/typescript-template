import { FlagshipServerProvider, type FlagshipBinding } from "@cloudflare/flagship/server";
import { OpenFeature, TypedInMemoryProvider } from "@openfeature/server-sdk";
import { Context, Effect, Layer, Ref } from "effect";

import {
  booleanForVariation,
  flagDefinitions,
  flagDefinitionByKey,
  variationForBoolean,
  type FlagDefinition,
  type FlagKey,
} from "./definitions.ts";

export type FlagState = Readonly<{
  description: string;
  enabled: boolean;
  key: FlagKey;
}>;

type FeatureFlagsService = Readonly<{
  readonly getBoolean: (flagKey: FlagKey) => Effect.Effect<boolean>;
  readonly list: () => Effect.Effect<readonly FlagState[]>;
  readonly setBoolean: (flagKey: FlagKey, enabled: boolean) => Effect.Effect<FlagState>;
}>;

class FeatureFlags extends Context.Service<FeatureFlags, FeatureFlagsService>()(
  "@repo/feature-flags/FeatureFlags",
) {}

const memoryConfiguration = Object.fromEntries(
  flagDefinitions.map((definition) => [
    definition.key,
    {
      defaultVariant: definition.defaultVariation,
      disabled: !definition.enabled,
      variants: definition.variations,
    },
  ]),
);

const booleanFromClient = (
  flagBooleanLookup: Readonly<{
    client: ReturnType<typeof OpenFeature.getClient>;
    defaultVariation: FlagDefinition["defaultVariation"];
    flagKey: FlagKey;
  }>,
): Effect.Effect<boolean> =>
  Effect.promise(() =>
    flagBooleanLookup.client.getBooleanValue(
      flagBooleanLookup.flagKey,
      booleanForVariation(flagBooleanLookup.defaultVariation),
    ),
  );

const flagStateForDefinition = (
  client: ReturnType<typeof OpenFeature.getClient>,
  definition: FlagDefinition,
): Effect.Effect<FlagState> =>
  Effect.gen(function* flagStateForDefinitionProgram() {
    const enabled = yield* booleanFromClient({
      client,
      defaultVariation: definition.defaultVariation,
      flagKey: definition.key,
    });
    return { description: definition.description, enabled, key: definition.key };
  });

const featureFlagsFromClient = (
  client: ReturnType<typeof OpenFeature.getClient>,
  write: (flagKey: FlagKey, enabled: boolean) => Effect.Effect<FlagState>,
): FeatureFlagsService => ({
  getBoolean: (flagKey: FlagKey) =>
    booleanFromClient({
      client,
      defaultVariation: flagDefinitionByKey[flagKey].defaultVariation,
      flagKey,
    }),
  list: () =>
    Effect.all(flagDefinitions.map((definition) => flagStateForDefinition(client, definition))),
  setBoolean: (flagKey: FlagKey, enabled: boolean) => write(flagKey, enabled),
});

const memoryFeatureFlags = Effect.fn("memoryFeatureFlags")(function* memoryFeatureFlags() {
  const provider = new TypedInMemoryProvider(memoryConfiguration);
  const variations = yield* Ref.make(
    Object.fromEntries(
      flagDefinitions.map((definition) => [
        definition.key,
        booleanForVariation(definition.defaultVariation),
      ]),
    ) as Record<FlagKey, boolean>,
  );
  yield* Effect.promise(() => OpenFeature.setProviderAndWait(provider));
  const client = OpenFeature.getClient();
  const writeMemoryBoolean = Effect.fn("memoryWriteBoolean")(function* memoryWriteBoolean(
    flagKey: FlagKey,
    enabled: boolean,
  ) {
    const storedVariations = yield* Ref.get(variations);
    yield* Ref.set(variations, { ...storedVariations, [flagKey]: enabled });
    const definition = flagDefinitionByKey[flagKey];
    provider.putConfiguration({
      ...memoryConfiguration,
      [flagKey]: {
        defaultVariant: variationForBoolean(enabled),
        disabled: !definition.enabled,
        variants: definition.variations,
      },
    });
    return { description: definition.description, enabled, key: flagKey };
  });
  return featureFlagsFromClient(client, writeMemoryBoolean);
});

const flagshipFeatureFlags = Effect.fn("flagshipFeatureFlags")(function* flagshipFeatureFlags(
  binding: FlagshipBinding,
) {
  const provider = new FlagshipServerProvider({ binding });
  yield* Effect.promise(() => OpenFeature.setProviderAndWait(provider));
  const client = OpenFeature.getClient();
  return featureFlagsFromClient(client, (flagKey, enabled) =>
    Effect.succeed({
      description: flagDefinitionByKey[flagKey].description,
      enabled,
      key: flagKey,
    }),
  );
});

const memoryFeatureFlagsLayer = Layer.unwrap(
  memoryFeatureFlags().pipe(
    Effect.map((service) => Layer.succeed(FeatureFlags, service)),
    Effect.orDie,
  ),
);

const flagshipFeatureFlagsLayer = (binding: FlagshipBinding): Layer.Layer<FeatureFlags> =>
  Layer.unwrap(
    flagshipFeatureFlags(binding).pipe(
      Effect.map((service) => Layer.succeed(FeatureFlags, service)),
      Effect.orDie,
    ),
  );

export { FeatureFlags, flagshipFeatureFlagsLayer, memoryFeatureFlagsLayer };
