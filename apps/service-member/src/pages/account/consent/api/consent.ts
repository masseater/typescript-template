import { httpStatus } from "@repo/observability/http-status";
import { decodeJson } from "@repo/runtime/client";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Schema } from "effect";

const ClientView = Schema.Struct({ client_name: Schema.optionalKey(Schema.String) });
const Redirect = Schema.Struct({ url: Schema.String });
const ConsentBody = Schema.Struct({
  accept: Schema.Boolean,
  oauth_query: Schema.String,
  scope: Schema.optionalKey(Schema.String),
});
const encodeConsentBody = Schema.encodePromise(Schema.fromJsonString(ConsentBody));

class ConsentClientUnavailable extends Schema.TaggedError<ConsentClientUnavailable>()(
  "ConsentClientUnavailable",
  {},
) {}

function clientNameFrom(response: Response, clientId: string): Promise<string> {
  if (!response.ok) {
    return Promise.reject(new ConsentClientUnavailable());
  }
  return response.json().then((payload) => decodeJson(ClientView, payload).client_name ?? clientId);
}

function getPublicClient(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  return fetchImpl(url, init);
}

function postConsent(fetchImpl: typeof fetch, body: string): Promise<Response> {
  return fetchImpl("/api/auth/oauth2/consent", {
    body,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

const loadClientName = createIsomorphicFn()
  .server((clientId: string): Promise<string> =>
    import("@tanstack/react-start/server").then(({ getRequest }) => {
      const request = getRequest();
      return getPublicClient(
        fetch,
        new URL(
          `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
          new URL(request.url).origin,
        ).toString(),
        { headers: { cookie: request.headers.get("cookie") ?? "" } },
      ).then((response) => {
        if (response.status === httpStatus.unauthorized) {
          throw new ConsentClientUnavailable();
        }
        return clientNameFrom(response, clientId);
      });
    }),
  )
  .client((clientId: string): Promise<string> =>
    getPublicClient(
      fetch,
      `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
      { cache: "no-store", credentials: "same-origin" },
    ).then((response) => {
      if (response.status === httpStatus.unauthorized) {
        globalThis.location.assign(`/login${globalThis.location.search}`);
        throw new ConsentClientUnavailable();
      }
      return clientNameFrom(response, clientId);
    }),
  );

function submitDecision(accept: boolean, scopes: readonly string[]): Promise<void> {
  return encodeConsentBody({
    accept,
    oauth_query: globalThis.location.search.slice(1),
    ...(accept ? { scope: scopes.join(" ") } : {}),
  }).then((body) =>
    postConsent(fetch, body).then((response) => {
      if (!response.ok) {
        throw new Error("連携の許可を処理できませんでした。");
      }
      return response.json().then((payload) => {
        globalThis.location.assign(decodeJson(Redirect, payload).url);
      });
    }),
  );
}

export { ConsentClientUnavailable, loadClientName, submitDecision };
