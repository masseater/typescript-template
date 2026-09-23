import { decodeJson } from "@repo/runtime/client";
import { Page, STATUS_VARIANT, StatusMessage } from "@repo/ui";
import { getRouteApi } from "@tanstack/react-router";
import { Schema } from "effect";
import { useEffect, useState } from "react";

import { serviceName } from "#shared/config/index.ts";
import { ConsentActions } from "./consent-actions.tsx";

import type { ReactElement } from "react";

const consentRoute = getRouteApi("/consent");
const ClientView = Schema.Struct({ client_name: Schema.optionalKey(Schema.String) });

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
      .then((payload) => decodeJson(ClientView, payload).client_name ?? clientId);
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
  return (
    <Page title={`${serviceName} との連携`}>
      {clientId === undefined && (
        <StatusMessage variant={STATUS_VARIANT.failure}>
          連携を求めているクライアントが分かりません。
        </StatusMessage>
      )}
      {client !== undefined && <ConsentActions client={client} onError={setError} />}
      {clientId !== undefined && client === undefined && error === "" && (
        <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>
      )}
      {error !== "" && <StatusMessage variant={STATUS_VARIANT.failure}>{error}</StatusMessage>}
    </Page>
  );
}

export { ConsentPage };
