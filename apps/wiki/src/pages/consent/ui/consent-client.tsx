import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { Status, failureMessage, request } from "@template/ui";
import { ConsentActions } from "./consent-actions.tsx";
import type { ReactElement } from "react";
import { Schema } from "effect";
import { decodeJson } from "@template/runtime/client";
import { useAtomValue } from "@effect/atom-react";

const HTTP_UNAUTHORIZED = 401;
const ClientView = Schema.Struct({ client_name: Schema.optionalKey(Schema.String) });

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
  return decodeJson(ClientView, await response.json()).client_name ?? clientId;
}

const clientNameAtom = Atom.family((clientId: string) =>
  Atom.make(request(async () => loadClientName(clientId))).pipe(Atom.withServerValueInitial),
);

function ConsentClient({ clientId }: Readonly<{ clientId: string }>): ReactElement {
  const result = useAtomValue(clientNameAtom(clientId));
  if (AsyncResult.isFailure(result)) {
    return <Status variant="error">{failureMessage(result)}</Status>;
  }
  if (!AsyncResult.isSuccess(result) || result.value === undefined) {
    return <Status variant="pending">読み込み中です。</Status>;
  }
  return <ConsentActions client={result.value} />;
}

export { ConsentClient };
