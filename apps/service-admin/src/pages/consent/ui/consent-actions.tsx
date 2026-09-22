import { decodeJson } from "@repo/runtime/client";
import { Button, FormColumn } from "@repo/ui";
import { Schema } from "effect";
import { useState } from "react";

import { serviceName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

const Redirect = Schema.Struct({ url: Schema.String });
const ConsentBody = Schema.Struct({
  accept: Schema.Boolean,
  oauth_query: Schema.String,
});
const encodeConsentBody = Schema.encodePromise(Schema.fromJsonString(ConsentBody));

function postConsent(fetchImpl: typeof fetch, body: string): Promise<Response> {
  return fetchImpl("/api/auth/oauth2/consent", {
    body,
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

function submitDecision(accept: boolean): Promise<void> {
  return encodeConsentBody({
    accept,
    oauth_query: globalThis.location.search.slice(1),
  }).then((body) =>
    postConsent(fetch, body).then((response) => {
      if (!response.ok) {
        throw new Error("連携の許可を処理できませんでした。");
      }
      return response.json().then((payload) => {
        globalThis.location.assign(decodeJson(Redirect, payload).url);
      });
    }),
  );
}

function ConsentActions({
  client,
  onError,
}: Readonly<{ client: string; onError: (message: string) => void }>): ReactElement {
  const [pending, setPending] = useState(false);
  function decide(accept: boolean): void {
    setPending(true);
    onError("");
    void submitDecision(accept).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : String(error));
      setPending(false);
    });
  }
  function allow(): void {
    decide(true);
  }
  function deny(): void {
    decide(false);
  }
  return (
    <FormColumn>
      <p>
        {client} に {serviceName} の管理操作を許可しますか？
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
}

export { ConsentActions };
