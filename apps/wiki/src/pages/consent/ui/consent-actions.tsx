import { Button, FormColumn, Status, useAction } from "@template/ui";
import type { ReactElement } from "react";
import { Schema } from "effect";
import { decodeJson } from "@template/runtime/client";
import { serviceName } from "#shared/config/index.ts";

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

function ConsentActions({ client }: Readonly<{ client: string }>): ReactElement {
  const action = useAction();
  function allow(): void {
    action.run(async () => submitDecision(true));
  }
  function deny(): void {
    action.run(async () => submitDecision(false));
  }
  return (
    <FormColumn>
      <p>
        {client} に {serviceName} の閲覧を許可しますか？
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={action.blocked} onClick={allow}>
          許可する
        </Button>
        <Button type="button" disabled={action.blocked} onClick={deny}>
          拒否する
        </Button>
      </div>
      {action.error !== undefined && <Status variant="error">{action.error}</Status>}
    </FormColumn>
  );
}

export { ConsentActions };
