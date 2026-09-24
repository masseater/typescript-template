import { submitConsent } from "@repo/auth-ui";
import { OAuthClientView } from "@repo/auth-ui/consent";
import { httpStatus } from "@repo/config";
import { decodeJson } from "@repo/runtime/client";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Schema } from "effect";

class ConsentClientUnavailable extends Schema.TaggedError<ConsentClientUnavailable>()(
  "ConsentClientUnavailable",
  {},
) {}

function clientNameFrom(response: Response, clientId: string): Promise<string> {
  if (!response.ok) {
    return Promise.reject(new ConsentClientUnavailable());
  }
  return response
    .json()
    .then((payload) => decodeJson(OAuthClientView, payload).client_name ?? clientId);
}

function getPublicClient(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  return fetchImpl(url, init);
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
  return submitConsent(accept ? { accept, scope: scopes.join(" ") } : { accept });
}

export { ConsentClientUnavailable, loadClientName, submitDecision };
