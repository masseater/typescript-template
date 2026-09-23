import { httpStatus, type Application } from "@repo/config";
import { Effect, Schema } from "effect";

import { AuthApps, clientOf } from "./auth-test-fixture.ts";
import { origins, type BrowserClient } from "./browser-client-test-fixture.ts";
import { UnexpectedStatus } from "./unexpected-status-test-fixture.ts";

type OAuthClient = Readonly<{
  application: Application;
  clientName: string;
  redirectUri: string;
  scope: string;
}>;

type AuthorizationFlow = Readonly<{
  clientId: string;
  oauth: OAuthClient;
  oauthQuery: string;
  verifier: string;
}>;

const VERIFIER_BYTES = 32;
const encodeBase64Url = (bytes: Uint8Array): string =>
  btoa(Array.from(bytes, (codePoint) => String.fromCodePoint(codePoint)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const Registration = Schema.Struct({ client_id: Schema.String });
const Redirect = Schema.Struct({ url: Schema.String });
const Tokens = Schema.fromJsonString(Schema.Struct({ access_token: Schema.String }));

const pkceChallenge = Effect.fn("pkceChallenge")(function* pkceChallenge(verifier: string) {
  const digest = yield* Effect.promise(() =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  return encodeBase64Url(new Uint8Array(digest));
});

const authorizeUrl = (oauth: OAuthClient, clientId: string, challenge: string): URL => {
  const origin = origins[oauth.application];
  const authorizeQuery = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: oauth.redirectUri,
    resource: `${origin}/mcp`,
    response_type: "code",
    scope: oauth.scope,
    state: "state-value",
  });
  return new URL(`/api/auth/oauth2/authorize?${authorizeQuery.toString()}`, origin);
};

const registerClient = Effect.fn("registerClient")(function* registerClient(
  oauth: OAuthClient,
  anonymous: BrowserClient,
) {
  const registration = yield* anonymous.json("/oauth2/register", {
    client_name: oauth.clientName,
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [oauth.redirectUri],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
  if (registration.status !== httpStatus.created) {
    return yield* new UnexpectedStatus({
      endpoint: "/oauth2/register",
      status: registration.status,
    });
  }
  return (yield* Schema.decodeUnknownEffect(Registration)(registration.body)).client_id;
});

const startOAuthAuthorization = Effect.fn("startOAuthAuthorization")(
  function* startOAuthAuthorization(oauth: OAuthClient) {
    const anonymous = yield* clientOf(oauth.application);
    const clientId = yield* registerClient(oauth, anonymous);
    const verifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)));
    const redirect = yield* anonymous.navigate(
      authorizeUrl(oauth, clientId, yield* pkceChallenge(verifier)).href,
    );
    const login = new URL(redirect.headers.get("location") ?? "", origins[oauth.application]);
    const flow: AuthorizationFlow = {
      clientId,
      oauth,
      oauthQuery: login.search.slice(1),
      verifier,
    };
    return flow;
  },
);

const redirectUrl = Effect.fn("redirectUrl")(function* redirectUrl(body: unknown, base?: string) {
  return new URL((yield* Schema.decodeUnknownEffect(Redirect)(body)).url, base);
});

const grantOAuthAuthorization = Effect.fn("grantOAuthAuthorization")(
  function* grantOAuthAuthorization(client: BrowserClient, oauthQuery: string, scope?: string) {
    const continued = yield* client.json("/oauth2/continue", {
      oauth_query: oauthQuery,
      postLogin: true,
    });
    const consentPage = yield* redirectUrl(continued.body, client.origin);
    const consented = yield* client.json("/oauth2/consent", {
      accept: true,
      oauth_query: consentPage.search.slice(1),
      ...(scope === undefined ? {} : { scope }),
    });
    const callbackUrl = yield* redirectUrl(consented.body);
    return callbackUrl.searchParams.get("code") ?? "";
  },
);

const exchangeOAuthCode = Effect.fn("exchangeOAuthCode")(function* exchangeOAuthCode(
  flow: AuthorizationFlow,
  code: string,
) {
  const { instance } = (yield* AuthApps)[flow.oauth.application];
  const origin = origins[flow.oauth.application];
  const exchange = new Request(`${origin}/api/auth/oauth2/token`, {
    body: new URLSearchParams({
      client_id: flow.clientId,
      code,
      code_verifier: flow.verifier,
      grant_type: "authorization_code",
      redirect_uri: flow.oauth.redirectUri,
      resource: `${origin}/mcp`,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const issued = yield* Effect.promise(() => instance.handler(exchange));
  const text = yield* Effect.promise(() => issued.text());
  return yield* Schema.decodeEffect(Tokens)(text);
});

export { exchangeOAuthCode, grantOAuthAuthorization, startOAuthAuthorization };
