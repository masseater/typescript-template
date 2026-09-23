import { Effect, Redacted, Schema } from "effect";
import { FetchHttpClient, HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";

import {
  booleanForVariation,
  flagDefinitionByKey,
  flagVariations,
  variationForBoolean,
  type FlagKey,
} from "./definitions.ts";

const RemoteFlag = Schema.Struct({
  defaultVariation: Schema.Literals(flagVariations),
  enabled: Schema.Boolean,
  key: Schema.String,
  variations: Schema.Record(Schema.String, Schema.Boolean),
});
const RemotePayload = Schema.Struct({
  result: Schema.optional(RemoteFlag),
});

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

const flagshipFlagUrl = (config: FlagshipWriteConfig, flagKey: FlagKey): string =>
  `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/flagship/apps/${config.appId}/flags/${flagKey}`;

const authorization = (config: FlagshipWriteConfig): { readonly Authorization: string } => ({
  Authorization: `Bearer ${Redacted.value(config.authToken)}`,
});

class FlagshipWriteFailed extends Schema.TaggedError<FlagshipWriteFailed>()("FlagshipWriteFailed", {
  detail: Schema.String,
}) {}

const asFlagshipFailure = (cause: unknown): FlagshipWriteFailed =>
  new FlagshipWriteFailed({ detail: String(cause) });

const readFlag = Effect.fn("readFlag")(function* readFlag(
  config: FlagshipWriteConfig,
  flagKey: FlagKey,
) {
  const httpResponse = yield* HttpClient.get(flagshipFlagUrl(config, flagKey), {
    headers: authorization(config),
  }).pipe(Effect.provide(FetchHttpClient.layer), Effect.mapError(asFlagshipFailure));
  if (httpResponse.status < 200 || httpResponse.status >= 300) {
    return yield* new FlagshipWriteFailed({ detail: `read ${httpResponse.status}` });
  }
  const parsedPayload = yield* HttpClientResponse.schemaBodyJson(RemotePayload)(httpResponse).pipe(
    Effect.mapError(asFlagshipFailure),
  );
  const remoteFlag = parsedPayload.result;
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
  const remoteFlag = yield* readFlag(change.config, change.flagKey);
  const defaultVariation = variationForBoolean(change.enabled);
  const requestBody = yield* HttpBody.json({
    defaultVariation,
    enabled: definition.enabled,
    key: change.flagKey,
    rules: [],
    variations: definition.variations,
  }).pipe(Effect.mapError(asFlagshipFailure));
  const httpResponse = yield* HttpClient.put(flagshipFlagUrl(change.config, change.flagKey), {
    body: requestBody,
    headers: {
      ...authorization(change.config),
      "Content-Type": "application/json",
    },
  }).pipe(Effect.provide(FetchHttpClient.layer), Effect.mapError(asFlagshipFailure));
  if (httpResponse.status < 200 || httpResponse.status >= 300) {
    return yield* new FlagshipWriteFailed({ detail: `write ${httpResponse.status}` });
  }
  return {
    enabled: booleanForVariation(defaultVariation),
    flagKey: change.flagKey,
    previous: booleanForVariation(remoteFlag.defaultVariation),
  };
});

export { FlagshipWriteConfig, FlagshipWriteFailed, writeFlag };
