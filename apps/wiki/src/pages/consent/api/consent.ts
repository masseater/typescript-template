import { ConsentRedirect, OAuthClientView } from "@template/runtime/contracts";
import { decodeJson } from "@template/runtime/client";

const HTTP_UNAUTHORIZED = 401;

async function loadClientName(clientId: string): Promise<string | undefined> {
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
  return decodeJson(OAuthClientView, await response.json()).client_name ?? clientId;
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
  globalThis.location.assign(decodeJson(ConsentRedirect, await response.json()).url);
}

export { loadClientName, submitDecision };
