import { Effect, Redacted, Schema } from "effect";
import {
  FetchHttpClient,
  HttpBody,
  HttpClient,
  HttpClientResponse,
  type HttpClientError,
} from "effect/unstable/http";

import { booleanForVariation, flagVariations, variationForBoolean } from "./definitions.ts";

const RemoteFlag = Schema.Struct({
  default_variation: Schema.Literals(flagVariations),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  enabled: Schema.Boolean,
  key: Schema.String,
  rules: Schema.Array(Schema.Unknown),
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

const flagshipFlagUrl = (config: FlagshipWriteConfig, flagKey: string): string =>
  `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/flagship/apps/${config.appId}/flags/${flagKey}`;

const authorization = (config: FlagshipWriteConfig): { readonly Authorization: string } => ({
  Authorization: `Bearer ${Redacted.value(config.authToken)}`,
});

class FlagshipWriteFailed extends Schema.TaggedError<FlagshipWriteFailed>()("FlagshipWriteFailed", {
  detail: Schema.String,
}) {}

const asFlagshipFailure = (cause: unknown): FlagshipWriteFailed =>
  new FlagshipWriteFailed({ detail: String(cause) });

const acceptedResponse = (
  operation: "read" | "write",
  sent: Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    HttpClientError.HttpClientError,
    HttpClient.HttpClient
  >,
): Effect.Effect<HttpClientResponse.HttpClientResponse, FlagshipWriteFailed> =>
  sent.pipe(
    Effect.provide(FetchHttpClient.layer),
    Effect.mapError(asFlagshipFailure),
    Effect.filterOrFail(
      (httpResponse) => httpResponse.status >= 200 && httpResponse.status < 300,
      (httpResponse) => new FlagshipWriteFailed({ detail: `${operation} ${httpResponse.status}` }),
    ),
  );

const readFlag = Effect.fn("readFlag")(function* readFlag(
  config: FlagshipWriteConfig,
  flagKey: string,
) {
  const httpResponse = yield* acceptedResponse(
    "read",
    HttpClient.get(flagshipFlagUrl(config, flagKey), { headers: authorization(config) }),
  );
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
  readonly flagKey: string;
}) {
  const remoteFlag = yield* readFlag(change.config, change.flagKey);
  const defaultVariation = variationForBoolean(change.enabled);
  const { description, ...kept } = remoteFlag;
  const requestBody = yield* HttpBody.json({
    ...kept,
    ...(typeof description === "string" ? { description } : {}),
    default_variation: defaultVariation,
  }).pipe(Effect.mapError(asFlagshipFailure));
  yield* acceptedResponse(
    "write",
    HttpClient.put(flagshipFlagUrl(change.config, change.flagKey), {
      body: requestBody,
      headers: { ...authorization(change.config), "Content-Type": "application/json" },
    }),
  );
  return {
    enabled: booleanForVariation(defaultVariation),
    flagKey: change.flagKey,
    previous: booleanForVariation(remoteFlag.default_variation),
  };
});

export { FlagshipWriteConfig, FlagshipWriteFailed, writeFlag };
