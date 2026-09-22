import { Auth } from "@repo/auth";
import { APPLICATION } from "@repo/config";
import { Effect, Schema } from "effect";

import {
  AuthApps,
  redirectUri,
  startAuthorization,
  wikiAdministrator,
  wikiOrigin,
} from "@repo/auth/testing";
import { authorizeMcpRequest } from "./authorize-mcp.ts";

import type { AuthorizationFlow, BrowserClient } from "@repo/auth/testing";
const decodeRedirect = Schema.decodeUnknownEffect(Schema.Struct({ url: Schema.String }));
const Tokens = Schema.Struct({ access_token: Schema.String });

function responseStatus(value: unknown): number | undefined {
  return value instanceof Response ? value.status : undefined;
}

const grantAuthorization = Effect.fn("grantAuthorization")(function* grantAuthorization(
  wiki: BrowserClient,
  oauthQuery: string,
) {
  const continued = yield* wiki.json("/oauth2/continue", {
    oauth_query: oauthQuery,
    postLogin: true,
  });
  const consentPage = new URL((yield* decodeRedirect(continued.body)).url, wikiOrigin);
  const consented = yield* wiki.json("/oauth2/consent", {
    accept: true,
    oauth_query: consentPage.search.slice(1),
  });
  const callbackUrl = new URL((yield* decodeRedirect(consented.body)).url);
  return callbackUrl.searchParams.get("code") ?? "";
});

const exchangeCode = Effect.fn("exchangeCode")(function* exchangeCode(
  flow: AuthorizationFlow,
  code: string,
) {
  const wiki = (yield* AuthApps)[APPLICATION.wiki];
  const exchange = new Request(`${wikiOrigin}/api/auth/oauth2/token`, {
    body: new URLSearchParams({
      client_id: flow.clientId,
      code,
      code_verifier: flow.verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      resource: `${wikiOrigin}/mcp`,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const issued = yield* Effect.promise(() => wiki.instance.handler(exchange));
  const tokens = yield* Effect.promise(() => issued.json() as Promise<unknown>);
  return yield* Schema.decodeUnknownEffect(Tokens)(tokens);
});

const mcpRequest = Effect.fn("mcpRequest")(function* mcpRequest(token?: string) {
  const wiki = (yield* AuthApps)[APPLICATION.wiki];
  const incoming = new Request(`${wikiOrigin}/mcp`, {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    method: "POST",
  });
  return yield* authorizeMcpRequest(incoming, wikiOrigin).pipe(Effect.provideService(Auth, wiki));
});

export {
  exchangeCode,
  grantAuthorization,
  mcpRequest,
  responseStatus,
  startAuthorization,
  wikiAdministrator,
  wikiOrigin,
};
