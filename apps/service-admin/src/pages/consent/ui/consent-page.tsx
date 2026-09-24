import { OAuthClientView } from "@repo/auth-ui/consent";
import { decodeJson } from "@repo/runtime/client";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ConsentView } from "./consent-view.tsx";

import type { ReactElement } from "react";

const consentRoute = getRouteApi("/consent");

function getPublicClient(fetchImpl: typeof fetch, clientId: string): Promise<Response> {
  return fetchImpl(
    `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
    { cache: "no-store", credentials: "same-origin" },
  );
}

function loadClientName(clientId: string): Promise<string | undefined> {
  return getPublicClient(fetch, clientId).then((response) => {
    if (response.status === 401) {
      globalThis.location.assign(`/login${globalThis.location.search}`);
      return undefined;
    }
    if (!response.ok) {
      throw new Error("クライアントの情報を取得できませんでした。");
    }
    return response
      .json()
      .then((payload) => decodeJson(OAuthClientView, payload).client_name ?? clientId);
  });
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function useClientName(
  clientId: string | undefined,
  onError: (message: string) => void,
): string | undefined {
  const [client, setClient] = useState<string>();
  useEffect(() => {
    const state = { active: true };
    function load(id: string): void {
      void loadClientName(id)
        .then((name) => {
          if (state.active) {
            setClient(name);
          }
        })
        .catch((error: unknown) => {
          if (state.active) {
            onError(messageOf(error));
          }
        });
    }
    if (clientId !== undefined) {
      load(clientId);
    }
    return (): void => {
      state.active = false;
    };
  }, [clientId, onError]);
  return client;
}

function ConsentPage(): ReactElement {
  const { client_id: clientId } = consentRoute.useSearch();
  const [error, setError] = useState("");
  const client = useClientName(clientId, setError);
  return <ConsentView client={client} clientId={clientId} error={error} onError={setError} />;
}

export { ConsentPage };
