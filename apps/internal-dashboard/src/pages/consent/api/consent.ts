import { browserHttp } from "@repo/auth-ui";
import { OAuthClientView } from "@repo/auth-ui/consent";
import { httpStatus } from "@repo/config";
import { decodeJson } from "@repo/runtime/client";
import { Redirect } from "@repo/runtime/contracts";
import { queryOptions } from "@tanstack/react-query";
import { Effect } from "effect";
import { FetchHttpClient, HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";

function loadClientName(clientId: string): Effect.Effect<string | undefined> {
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
      return undefined;
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* Effect.die("クライアントの情報を取得できませんでした。");
    }
    return (
      (yield* HttpClientResponse.schemaBodyJson(OAuthClientView)(response)).client_name ?? clientId
    );
  }).pipe(Effect.orDie);
}

function clientNameOptions(clientId: string) {
  return queryOptions({
    queryFn: () =>
      Effect.runPromise(loadClientName(clientId).pipe(Effect.map((name) => name ?? null))),
    queryKey: ["oauth-client-name", clientId] as const,
    retry: false,
  });
}

function submitDecision(accept: boolean): Effect.Effect<void> {
  return Effect.gen(function* sendDecision() {
    const requestBody = yield* HttpBody.json({
      accept,
      oauth_query: globalThis.location.search.slice(1),
    });
    const response = yield* HttpClient.post("/api/auth/oauth2/consent", {
      body: requestBody,
    }).pipe(Effect.provide(browserHttp));
    if (response.status < 200 || response.status >= 300) {
      return yield* Effect.die("連携の許可を処理できませんでした。");
    }
    globalThis.location.assign(decodeJson(Redirect, yield* response.json).url);
  }).pipe(Effect.orDie);
}

export { clientNameOptions, submitDecision };
