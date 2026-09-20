import { Effect, type Redacted } from "effect";

import { recordFlagToggle } from "./audit.ts";
import { flagDefinitionByKey, type FlagKey } from "./definitions.ts";
import { type FlagshipWriteConfig, writeFlag } from "./flagship-write.ts";
import { FeatureFlags } from "./service.ts";

const toggleFlag = Effect.fn("toggleFlag")(function* toggleFlag(change: {
  readonly actorId: string;
  readonly enabled: boolean;
  readonly key: FlagKey;
}) {
  const featureFlags = yield* FeatureFlags;
  const previousEnabled = yield* featureFlags.getBoolean(change.key);
  if (previousEnabled === change.enabled) {
    const definition = flagDefinitionByKey[change.key];
    return { description: definition.description, enabled: previousEnabled, key: change.key };
  }
  const toggledFlag = yield* featureFlags.setBoolean(change.key, change.enabled);
  yield* recordFlagToggle({
    actorId: change.actorId,
    flagKey: change.key,
    from: previousEnabled,
    to: change.enabled,
  });
  return toggledFlag;
});

const toggleFlagRemote = Effect.fn("toggleFlagRemote")(function* toggleFlagRemote(
  config: typeof FlagshipWriteConfig.Type,
  change: {
    readonly actorId: string;
    readonly enabled: boolean;
    readonly key: FlagKey;
  },
) {
  const flagshipWrite = yield* writeFlag({
    config,
    enabled: change.enabled,
    flagKey: change.key,
  });
  yield* recordFlagToggle({
    actorId: change.actorId,
    flagKey: change.key,
    from: flagshipWrite.previous,
    to: change.enabled,
  });
  return {
    description: "",
    enabled: flagshipWrite.enabled,
    key: flagshipWrite.flagKey,
  };
});

type FlagshipToggleEnv = Readonly<{
  FLAGSHIP_ACCOUNT_ID: string;
  FLAGSHIP_API_TOKEN: Redacted.Redacted;
  FLAGSHIP_APP_ID: string;
}>;

export { toggleFlag, toggleFlagRemote };
export type { FlagshipToggleEnv };
