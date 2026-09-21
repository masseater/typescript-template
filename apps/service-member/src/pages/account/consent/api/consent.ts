import { httpStatus } from "@repo/observability/http-status";
import { decodeJson } from "@repo/runtime/client";
import { createIsomorphicFn } from "@tanstack/react-start";
import { Schema } from "effect";

const ClientView = Schema.Struct({ client_name: Schema.optionalKey(Schema.String) });
const Redirect = Schema.Struct({ url: Schema.String });

class ConsentClientUnavailable extends Error {
  override readonly name = "ConsentClientUnavailable";
}

async function clientNameFrom(response: Response, clientId: string): Promise<string> {
  if (!response.ok) {
    throw new ConsentClientUnavailable();
  }
  return decodeJson(ClientView, await response.json()).client_name ?? clientId;
}

const loadClientName = createIsomorphicFn()
  .server(async (clientId: string): Promise<string> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const response = await fetch(
      new URL(
        `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
        new URL(request.url).origin,
      ),
      { headers: { cookie: request.headers.get("cookie") ?? "" } },
    );
    if (response.status === httpStatus.unauthorized) {
      throw new ConsentClientUnavailable();
    }
    return clientNameFrom(response, clientId);
  })
  .client(async (clientId: string): Promise<string> => {
    const response = await fetch(
      `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
      { cache: "no-store", credentials: "same-origin" },
    );
    if (response.status === httpStatus.unauthorized) {
      globalThis.location.assign(`/login${globalThis.location.search}`);
      throw new ConsentClientUnavailable();
    }
    return clientNameFrom(response, clientId);
  });

async function submitDecision(accept: boolean, scopes: readonly string[]): Promise<void> {
  const response = await fetch("/api/auth/oauth2/consent", {
    body: JSON.stringify({
      accept,
      oauth_query: globalThis.location.search.slice(1),
      ...(accept ? { scope: scopes.join(" ") } : {}),
    }),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("連携の許可を処理できませんでした。");
  }
  globalThis.location.assign(decodeJson(Redirect, await response.json()).url);
}

export { loadClientName, submitDecision };
