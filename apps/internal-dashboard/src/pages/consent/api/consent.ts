import { httpStatus } from "@repo/observability/http-status";
import { decodeJson } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";
import { Schema } from "effect";

const ClientView = Schema.Struct({ client_name: Schema.optionalKey(Schema.String) });
const Redirect = Schema.Struct({ url: Schema.String });

async function loadClientName(clientId: string): Promise<string> {
  const response = await fetch(
    `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  if (response.status === httpStatus.unauthorized) {
    globalThis.location.assign(`/login${globalThis.location.search}`);
    throw new Error("ログインが必要です。");
  }
  if (!response.ok) {
    throw new Error("クライアントの情報を取得できませんでした。");
  }
  return decodeJson(ClientView, await response.json()).client_name ?? clientId;
}

function clientNameOptions(clientId: string) {
  return queryOptions({
    queryFn: () => loadClientName(clientId),
    queryKey: ["oauth-client-name", clientId] as const,
    retry: false,
  });
}

async function submitDecision(accept: boolean): Promise<void> {
  const response = await fetch("/api/auth/oauth2/consent", {
    body: JSON.stringify({ accept, oauth_query: globalThis.location.search.slice(1) }),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("連携の許可を処理できませんでした。");
  }
  globalThis.location.assign(decodeJson(Redirect, await response.json()).url);
}

export { clientNameOptions, loadClientName, submitDecision };
