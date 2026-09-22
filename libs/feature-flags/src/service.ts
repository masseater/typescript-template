import { FlagshipServerProvider, type FlagshipBinding } from "@cloudflare/flagship/server";
import { OpenFeature, TypedInMemoryProvider } from "@openfeature/server-sdk";
import { Context, Effect, Layer, Ref } from "effect";

import {
  booleanForVariation,
  flagDefinitions,
  flagDefinitionByKey,
  variationForBoolean,
  type FlagKey,
} from "./definitions.ts";
import { evaluationFromDetails, failClosedEnabled, type FlagEvaluation } from "./evaluation.ts";
import { FlagshipWriteFailed } from "./flagship-write.ts";

export type FlagState = Readonly<{
  description: string;
  enabled: boolean;
  key: FlagKey;
}>;

type FeatureFlagsService = Readonly<{
  readonly evaluateBoolean: (flagKey: FlagKey) => Effect.Effect<FlagEvaluation>;
  readonly getBoolean: (flagKey: FlagKey) => Effect.Effect<boolean>;
  readonly list: Effect.Effect<readonly FlagState[]>;
  readonly setBoolean: (
    flagKey: FlagKey,
    enabled: boolean,
  ) => Effect.Effect<FlagState, FlagshipWriteFailed>;
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

const evaluateFromClient = (
  client: ReturnType<typeof OpenFeature.getClient>,
  flagKey: FlagKey,
): Effect.Effect<FlagEvaluation> =>
  Effect.promise(() => client.getBooleanDetails(flagKey, failClosedEnabled)).pipe(
    Effect.map(evaluationFromDetails),
  );

const flagStateForKey = (
  client: ReturnType<typeof OpenFeature.getClient>,
  flagKey: FlagKey,
): Effect.Effect<FlagState> =>
  Effect.gen(function* flagStateForKeyProgram() {
    const evaluation = yield* evaluateFromClient(client, flagKey);
    const definition = flagDefinitionByKey[flagKey];
    return { description: definition.description, enabled: evaluation.enabled, key: flagKey };
  });

const featureFlagsFromClient = (
  client: ReturnType<typeof OpenFeature.getClient>,
  write: (flagKey: FlagKey, enabled: boolean) => Effect.Effect<FlagState, FlagshipWriteFailed>,
): FeatureFlagsService => ({
  evaluateBoolean: (flagKey: FlagKey) => evaluateFromClient(client, flagKey),
  getBoolean: (flagKey: FlagKey) =>
    evaluateFromClient(client, flagKey).pipe(Effect.map((evaluation) => evaluation.enabled)),
  list: Effect.forEach(flagDefinitions, (definition) => flagStateForKey(client, definition.key)),
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
  return featureFlagsFromClient(client, (flagKey, _enabled) =>
    Effect.fail(
      new FlagshipWriteFailed({
        detail: `remote write required for ${flagKey}`,
      }),
    ),
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
