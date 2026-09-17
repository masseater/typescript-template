import { createFileRoute } from "@tanstack/react-router";
import { Page, Status, UIProvider } from "@template/ui";
import uiStyles from "@template/ui/styles.css?url";
import { useEffect, useState } from "react";
import { Button, Stack } from "smarthr-ui";
import { Schema } from "effect";

export const Route = createFileRoute("/consent")({
  validateSearch: Schema.toStandardSchemaV1(
    Schema.Struct({ client_id: Schema.optionalKey(Schema.String) }),
  ),
  head: () => ({ links: [{ rel: "stylesheet", href: uiStyles }] }),
  component: Consent,
});

const ClientView = Schema.Struct({ client_name: Schema.optionalKey(Schema.String) });
const Redirect = Schema.Struct({ url: Schema.String });

async function loadClientName(clientId: string) {
  const response = await fetch(
    `/api/auth/oauth2/public-client?${new URLSearchParams({ client_id: clientId }).toString()}`,
    { credentials: "same-origin", cache: "no-store" },
  );
  if (response.status === 401) {
    window.location.assign(`/login${window.location.search}`);
    return null;
  }
  if (!response.ok) throw new Error("クライアントの情報を取得できませんでした。");
  return Schema.decodeUnknownSync(ClientView)(await response.json()).client_name ?? clientId;
}

function Consent() {
  const { client_id: clientId } = Route.useSearch();
  const [client, setClient] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!clientId) return undefined;
    let active = true;
    void loadClientName(clientId).then(
      (name) => {
        if (active) setClient(name);
        return undefined;
      },
      (cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : String(cause));
      },
    );
    return () => {
      active = false;
    };
  }, [clientId]);
  async function decide(accept: boolean) {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accept, oauth_query: window.location.search.slice(1) }),
      });
      if (!response.ok) throw new Error("連携の許可を処理できませんでした。");
      window.location.assign(Schema.decodeUnknownSync(Redirect)(await response.json()).url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPending(false);
    }
  }
  return (
    <UIProvider>
      <Page title="Wiki との連携">
        {!clientId && <Status error>連携を求めているクライアントが分かりません。</Status>}
        {client && (
          <Stack>
            <p>{client} に Wiki の閲覧を許可しますか？</p>
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => void decide(true)}
            >
              許可する
            </Button>
            <Button type="button" disabled={pending} onClick={() => void decide(false)}>
              拒否する
            </Button>
          </Stack>
        )}
        {clientId && !client && !error && <Status>読み込み中です。</Status>}
        {error && <Status error>{error}</Status>}
      </Page>
    </UIProvider>
  );
}
