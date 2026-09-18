import { decodeJson } from "@template/runtime/client";
import { Button, FormColumn } from "@template/ui";
import { Schema } from "effect";
import { useState, type ReactElement } from "react";

import { serviceName } from "#shared/config/index.ts";

const Redirect = Schema.Struct({ url: Schema.String });

const submitDecision = async (accept: boolean): Promise<void> => {
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
};

const ConsentActions = ({
  client,
  onError,
}: Readonly<{ client: string; onError: (message: string) => void }>): ReactElement => {
  const [pending, setPending] = useState(false);
  const decide = async (accept: boolean): Promise<void> => {
    setPending(true);
    onError("");
    try {
      await submitDecision(accept);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
      setPending(false);
    }
  };
  const allow = (): void => {
    void decide(true);
  };
  const deny = (): void => {
    void decide(false);
  };
  return (
    <FormColumn>
      <p>
        {client} に {serviceName} の閲覧を許可しますか？
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={pending} onClick={allow}>
          許可する
        </Button>
        <Button type="button" disabled={pending} onClick={deny}>
          拒否する
        </Button>
      </div>
    </FormColumn>
  );
};

export { ConsentActions };
