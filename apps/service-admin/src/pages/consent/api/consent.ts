import { browserHttp } from "@repo/auth-ui";
import { OAuthClientView } from "@repo/auth-ui/consent";
import { httpStatus } from "@repo/config";
import { queryOptions } from "@tanstack/react-query";
import { Effect } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";

function loadClientName(clientId: string): Effect.Effect<string | null> {
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
      return null;
    }
    if (response.status < 200 || response.status >= 300) {
      return yield* Effect.die(new Error("クライアントの情報を取得できませんでした。"));
    }
    return (
      (yield* HttpClientResponse.schemaBodyJson(OAuthClientView)(response)).client_name ?? clientId
    );
  }).pipe(Effect.orDie);
}

function clientNameOptions(clientId: string) {
  return queryOptions({
    queryFn: () => Effect.runPromise(loadClientName(clientId)),
    queryKey: ["oauth-client-name", clientId] as const,
    retry: false,
  });
}

export { clientNameOptions };
