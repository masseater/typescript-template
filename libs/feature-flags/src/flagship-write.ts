import { Effect, Redacted, Schema } from "effect";

import {
  booleanForVariation,
  flagDefinitionByKey,
  variationForBoolean,
  type FlagKey,
  type FlagVariation,
} from "./definitions.ts";

type RemoteFlag = Readonly<{
  defaultVariation: FlagVariation;
  enabled: boolean;
  key: string;
  variations: Readonly<Record<FlagVariation, boolean>>;
}>;

type FlagshipWriteConfig = Readonly<{
  accountId: string;
  appId: string;
  authToken: Redacted.Redacted;
}>;

const FlagshipWriteConfig = Schema.Struct({
  accountId: Schema.String,
  appId: Schema.String,
  authToken: Schema.Redacted(Schema.String),
});

class FlagshipWriteFailed extends Schema.TaggedError<FlagshipWriteFailed>()("FlagshipWriteFailed", {
  detail: Schema.String,
}) {}

const flagshipFlagUrl = (config: FlagshipWriteConfig, flagKey: FlagKey): string =>
  `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/flagship/apps/${config.appId}/flags/${flagKey}`;

const readFlag = Effect.fn("readFlag")(function* readFlag(
  config: FlagshipWriteConfig,
  flagKey: FlagKey,
) {
  const httpResponse = yield* Effect.tryPromise({
    catch: (cause) => new FlagshipWriteFailed({ detail: String(cause) }),
    try: () =>
      fetch(flagshipFlagUrl(config, flagKey), {
        headers: { Authorization: `Bearer ${Redacted.value(config.authToken)}` },
      }),
  });
  if (!httpResponse.ok) {
    return yield* new FlagshipWriteFailed({ detail: `read ${httpResponse.status}` });
  }
  const parsedPayload: { result?: RemoteFlag } = yield* Effect.tryPromise({
    catch: (cause) => new FlagshipWriteFailed({ detail: String(cause) }),
    try: (): Promise<{ result?: RemoteFlag }> => httpResponse.json(),
  });
  const remoteFlag: RemoteFlag | undefined = parsedPayload.result;
  if (remoteFlag === undefined) {
    return yield* new FlagshipWriteFailed({ detail: "missing flag" });
  }
  return remoteFlag;
});

const writeFlag = Effect.fn("writeFlag")(function* writeFlag(change: {
  readonly config: FlagshipWriteConfig;
  readonly enabled: boolean;
  readonly flagKey: FlagKey;
}) {
  const definition = flagDefinitionByKey[change.flagKey];
  const remoteFlag: RemoteFlag = yield* readFlag(change.config, change.flagKey);
  const defaultVariation = variationForBoolean(change.enabled);
  const httpResponse = yield* Effect.tryPromise({
    catch: (cause) => new FlagshipWriteFailed({ detail: String(cause) }),
    try: () =>
      fetch(flagshipFlagUrl(change.config, change.flagKey), {
        body: JSON.stringify({
          defaultVariation,
          enabled: definition.enabled,
          key: change.flagKey,
          rules: [],
          variations: definition.variations,
        }),
        headers: {
          Authorization: `Bearer ${Redacted.value(change.config.authToken)}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      }),
  });
  if (!httpResponse.ok) {
    return yield* new FlagshipWriteFailed({ detail: `write ${httpResponse.status}` });
  }
  return {
    enabled: booleanForVariation(defaultVariation),
    flagKey: change.flagKey,
    previous: booleanForVariation(remoteFlag.defaultVariation),
  };
});

export { FlagshipWriteConfig, FlagshipWriteFailed, writeFlag };
