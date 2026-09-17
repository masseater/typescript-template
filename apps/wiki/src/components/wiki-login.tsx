import { LoginPage } from "@template/ui/auth";
import type { ReactElement } from "react";
import { Schema } from "effect";
import { UIProvider } from "@template/ui";
import { decodeJson } from "@template/runtime/client";

const HTTP_FORBIDDEN = 403;
const Redirect = Schema.Struct({ url: Schema.String });

async function requestContinuation(oauthQuery: string): Promise<Response> {
  return fetch("/api/auth/oauth2/continue", {
    body: JSON.stringify({ oauth_query: oauthQuery, postLogin: true }),
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

async function continuationTarget(oauthQuery: string): Promise<string> {
  const response = await requestContinuation(oauthQuery);
  if (response.status === HTTP_FORBIDDEN) {
    return "/security";
  }
  if (!response.ok) {
    throw new Error("連携の許可を続けられませんでした。");
  }
  return decodeJson(Redirect, await response.json()).url;
}

async function continueAuthorization(): Promise<void> {
  const oauthQuery = globalThis.location.search.slice(1);
  if (!new URLSearchParams(oauthQuery).has("sig")) {
    globalThis.location.assign("/");
    return;
  }
  globalThis.location.assign(await continuationTarget(oauthQuery));
}

function WikiLogin(): ReactElement {
  return (
    <UIProvider>
      <LoginPage title="Wiki にログイン" signUp={false} onAuthenticated={continueAuthorization} />
    </UIProvider>
  );
}

export { WikiLogin };
