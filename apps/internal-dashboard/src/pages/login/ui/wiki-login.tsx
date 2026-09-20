import { LoginPage } from "@repo/auth-ui";
import { decodeJson } from "@repo/runtime/client";
import { Schema } from "effect";

import { serviceName } from "#shared/config/index.ts";

import type { ReactElement } from "react";

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
    <LoginPage
      title={`${serviceName} にログイン`}
      signUp={false}
      onAuthenticated={continueAuthorization}
    />
  );
}

export { WikiLogin };
