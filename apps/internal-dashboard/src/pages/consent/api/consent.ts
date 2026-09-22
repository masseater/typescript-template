import { browserHttp } from "@repo/auth-ui";
import { httpStatus } from "@repo/observability/http-status";
import { decodeJson } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { FetchHttpClient, HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";

const ClientView = Schema.Struct({ client_name: Schema.optionalKey(Schema.String) });
const Redirect = Schema.Struct({ url: Schema.String });

function loadClientName(clientId: string): Effect.Effect<string> {
  return Effect.gen(function* loadName() {
    const response = yield* HttpClient.get(
      `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
    ).pipe(
      Effect.provide(browserHttp),
      Effect.provideService(FetchHttpClient.RequestInit, {
        cache: "no-store",
        credentials: "same-origin",
      }),
    );
    if (response.status === httpStatus.unauthorized) {
      globalThis.location.assign(`/login${globalThis.location.search}`);
      return yield* Effect.die(new Error("ログインが必要です。"));
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* Effect.die(new Error("クライアントの情報を取得できませんでした。"));
    }
    return (yield* HttpClientResponse.schemaBodyJson(ClientView)(response)).client_name ?? clientId;
  }).pipe(Effect.orDie);
}

function clientNameOptions(clientId: string) {
  return queryOptions({
    queryFn: () => Effect.runPromise(loadClientName(clientId)),
    queryKey: ["oauth-client-name", clientId] as const,
    retry: false,
  });
}

function submitDecision(accept: boolean): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* sendDecision() {
      const requestBody = yield* HttpBody.json({
        accept,
        oauth_query: globalThis.location.search.slice(1),
      });
      const response = yield* HttpClient.post("/api/auth/oauth2/consent", {
        body: requestBody,
      }).pipe(Effect.provide(browserHttp));
      if (response.status < 200 || response.status >= 300) {
        return yield* Effect.die(new Error("連携の許可を処理できませんでした。"));
      }
      globalThis.location.assign(decodeJson(Redirect, yield* response.json).url);
    }).pipe(Effect.orDie),
  );
}

export { clientNameOptions, submitDecision };
