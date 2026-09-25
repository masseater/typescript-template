import { OAuthClientView } from "@repo/auth-ui/consent";
import { decodeJson } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";

function getPublicClient(clientId: string): Promise<Response> {
  return fetch(
    `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
    { cache: "no-store", credentials: "same-origin" },
  );
}

function loadClientName(clientId: string): Promise<string | null> {
  return getPublicClient(clientId).then((response) => {
    if (response.status === 401) {
      globalThis.location.assign(`/login${globalThis.location.search}`);
      return null;
    }
    if (!response.ok) {
      throw new Error("クライアントの情報を取得できませんでした。");
    }
    return response
      .json()
      .then((payload) => decodeJson(OAuthClientView, payload).client_name ?? clientId);
  });
}

function clientNameOptions(clientId: string) {
  return queryOptions({
    queryFn: () => loadClientName(clientId),
    queryKey: ["oauth-client-name", clientId] as const,
    retry: false,
  });
}

export { clientNameOptions };
