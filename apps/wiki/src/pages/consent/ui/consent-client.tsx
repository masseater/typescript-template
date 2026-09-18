import { Option, Schema } from "effect";
import { Status, request, serverQuery, useServerQuery } from "@template/ui";
import { ConsentActions } from "./consent-actions.tsx";
import type { ReactElement } from "react";
import type { ServerQuery } from "@template/ui";
import { decodeJson } from "@template/runtime/client";

const HTTP_UNAUTHORIZED = 401;
const ClientView = Schema.Struct({ client_name: Schema.optionalKey(Schema.String) });

async function loadClientName(clientId: string): Promise<Option.Option<string>> {
  const response = await fetch(
    `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  if (response.status === HTTP_UNAUTHORIZED) {
    globalThis.location.assign(`/login${globalThis.location.search}`);
    return Option.none();
  }
  if (!response.ok) {
    throw new Error("クライアントの情報を取得できませんでした。");
  }
  return Option.some(decodeJson(ClientView, await response.json()).client_name ?? clientId);
}

function clientNameQuery(clientId: string): ServerQuery<Option.Option<string>> {
  return serverQuery(
    ["oauth-client-name", clientId],
    request(async () => loadClientName(clientId)),
  );
}

function ConsentClient({ clientId }: Readonly<{ clientId: string }>): ReactElement {
  const result = useServerQuery(clientNameQuery(clientId));
  if (result.status === "failure") {
    return <Status variant="error">{result.message}</Status>;
  }
  if (result.status === "pending" || Option.isNone(result.value)) {
    return <Status variant="pending">読み込み中です。</Status>;
  }
  return <ConsentActions client={result.value.value} />;
}

export { ConsentClient };
