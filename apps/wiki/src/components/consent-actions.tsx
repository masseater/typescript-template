import { useCallback, useState } from "react";
import { Button } from "@template/ui/ui";
import type { ReactElement } from "react";
import { Schema } from "effect";
import { decodeJson } from "@template/runtime/client";

const Redirect = Schema.Struct({ url: Schema.String });

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

function ConsentActions({
  client,
  onError,
}: Readonly<{ client: string; onError: (message: string) => void }>): ReactElement {
  const [pending, setPending] = useState(false);
  const decide = useCallback(
    async (accept: boolean) => {
      setPending(true);
      onError("");
      try {
        await submitDecision(accept);
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
        setPending(false);
      }
    },
    [onError],
  );
  const allow = useCallback(() => {
    void decide(true);
  }, [decide]);
  const deny = useCallback(() => {
    void decide(false);
  }, [decide]);
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <p>{client} に Wiki の閲覧を許可しますか？</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={pending} onClick={allow}>
          許可する
        </Button>
        <Button type="button" disabled={pending} onClick={deny}>
          拒否する
        </Button>
      </div>
    </div>
  );
}

export { ConsentActions };
