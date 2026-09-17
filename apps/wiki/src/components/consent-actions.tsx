import { Button, Stack } from "smarthr-ui";
import { object, parse, string } from "valibot";
import { useCallback, useState } from "react";
import type { ReactElement } from "react";

const redirectSchema = object({ url: string() });

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
  globalThis.location.assign(parse(redirectSchema, await response.json()).url);
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
    <Stack>
      <p>{client} に Wiki の閲覧を許可しますか？</p>
      <Button type="button" variant="primary" disabled={pending} onClick={allow}>
        許可する
      </Button>
      <Button type="button" disabled={pending} onClick={deny}>
        拒否する
      </Button>
    </Stack>
  );
}

export { ConsentActions };
