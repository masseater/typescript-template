import { getRouteApi } from "@tanstack/react-router";
import { decodeJson } from "@template/runtime/client";
import { Page, Status } from "@template/ui";
import { Schema } from "effect";
import { useEffect, useState, type ReactElement } from "react";

import { serviceName } from "#shared/config/index.ts";
import { ConsentActions } from "./consent-actions.tsx";

const HTTP_UNAUTHORIZED = 401;
const consentRoute = getRouteApi("/consent");
const ClientView = Schema.Struct({ client_name: Schema.optionalKey(Schema.String) });

const loadClientName = async (clientId: string): Promise<string | undefined> => {
  const response = await fetch(
    `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  if (response.status === HTTP_UNAUTHORIZED) {
    globalThis.location.assign(`/login${globalThis.location.search}`);
    return undefined;
  }
  if (!response.ok) {
    throw new Error("クライアントの情報を取得できませんでした。");
  }
  return decodeJson(ClientView, await response.json()).client_name ?? clientId;
};

const messageOf = (cause: unknown): string => {
  return cause instanceof Error ? cause.message : String(cause);
};

const useClientName = (
  clientId: string | undefined,
  onError: (message: string) => void,
): string | undefined => {
  const [client, setClient] = useState<string>();
  useEffect(() => {
    const state = { active: true };
    const load = async (id: string): Promise<void> => {
      try {
        const name = await loadClientName(id);
        if (state.active) {
          setClient(name);
        }
      } catch (error) {
        if (state.active) {
          onError(messageOf(error));
        }
      }
    };
    if (clientId !== undefined) {
      void load(clientId);
    }
    return (): void => {
      state.active = false;
    };
  }, [clientId, onError]);
  return client;
};

const ConsentPage = (): ReactElement => {
  const { client_id: clientId } = consentRoute.useSearch();
  const [error, setError] = useState("");
  const client = useClientName(clientId, setError);
  return (
    <Page title={`${serviceName} との連携`}>
      {clientId === undefined && (
        <Status variant="error">連携を求めているクライアントが分かりません。</Status>
      )}
      {client !== undefined && <ConsentActions client={client} onError={setError} />}
      {clientId !== undefined && client === undefined && error === "" && (
        <Status variant="pending">読み込み中です。</Status>
      )}
      {error !== "" && <Status variant="error">{error}</Status>}
    </Page>
  );
};

export { ConsentPage };
