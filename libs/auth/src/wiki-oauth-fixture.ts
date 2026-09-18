import { APPLICATION } from "@repo/config";
import { httpStatus } from "@repo/observability";
import { Effect, Schema } from "effect";

import {
  AuthApps,
  PASSWORD,
  bootstrapVerifiedAdmin,
  clientOf,
  enableTotp,
  requireStatus,
  signInAs,
} from "./auth-test-fixture.ts";
import { Auth } from "./auth.ts";
import { origins, type BrowserClient } from "./browser-client.ts";
import { authorizeMcpRequest } from "./mcp.ts";
import { UnexpectedStatus } from "./unexpected-status.ts";

type AuthorizationFlow = {
  readonly clientId: string;
  readonly oauthQuery: string;
  readonly verifier: string;
};

const wikiOrigin = origins.wiki;
const redirectUri = "http://127.0.0.1:43123/callback";
const VERIFIER_BYTES = 32;
const decodeRedirect = Schema.decodeUnknownEffect(Schema.Struct({ url: Schema.String }));
const Registration = Schema.Struct({ client_id: Schema.String });
const Tokens = Schema.Struct({ access_token: Schema.String });

const wikiAdministrator = Effect.fn("wikiAdministrator")(function* wikiAdministrator(
  email: string,
) {
  yield* bootstrapVerifiedAdmin(email);
  const { authenticator } = yield* enableTotp(yield* signInAs(APPLICATION.admin, email));
  const client = yield* clientOf(APPLICATION.wiki);
  yield* requireStatus(httpStatus.ok, {
    client,
    endpoint: "/sign-in/email",
    jsonFields: { email, password: PASSWORD },
  });
  yield* requireStatus(httpStatus.ok, {
    client,
    endpoint: "/two-factor/verify-totp",
    jsonFields: { code: authenticator.generate() },
  });
  return client;
});

const pkceChallenge = Effect.fn("pkceChallenge")(function* pkceChallenge(verifier: string) {
  const digest = yield* Effect.promise(async () =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  return Buffer.from(digest).toString("base64url");
});

const authorizeUrl = (clientId: string, challenge: string): URL => {
  const authorizeQuery = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    resource: `${wikiOrigin}/mcp`,
    response_type: "code",
    scope: "wiki:read offline_access",
    state: "state-value",
  });
  return new URL(`/api/auth/oauth2/authorize?${authorizeQuery.toString()}`, wikiOrigin);
};

const registerClient = Effect.fn("registerClient")(function* registerClient(
  anonymous: BrowserClient,
) {
  const registration = yield* anonymous.json("/oauth2/register", {
    client_name: "Test MCP client",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [redirectUri],
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

const startAuthorization = Effect.fn("startAuthorization")(function* startAuthorization() {
  const anonymous = yield* clientOf(APPLICATION.wiki);
  const clientId = yield* registerClient(anonymous);
  const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES))).toString(
    "base64url",
  );
  const redirect = yield* anonymous.navigate(
    authorizeUrl(clientId, yield* pkceChallenge(verifier)).href,
  );
  const login = new URL(redirect.headers.get("location") ?? "", wikiOrigin);
  const flow: AuthorizationFlow = { clientId, oauthQuery: login.search.slice(1), verifier };
  return flow;
});

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
  const { wiki } = yield* AuthApps;
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
  const issued = yield* Effect.promise(async () => wiki.instance.handler(exchange));
  const tokens = yield* Effect.promise(async (): Promise<unknown> => issued.json());
  return (yield* Schema.decodeUnknownEffect(Tokens)(tokens)).access_token;
});

const authorizedAccessToken = Effect.fn("authorizedAccessToken")(function* authorizedAccessToken(
  email: string,
) {
  const flow = yield* startAuthorization();
  const wiki = yield* wikiAdministrator(email);
  return yield* exchangeCode(flow, yield* grantAuthorization(wiki, flow.oauthQuery));
});

const mcpRequest = Effect.fn("mcpRequest")(function* mcpRequest(token?: string) {
  const { wiki } = yield* AuthApps;
  const incoming = new Request(`${wikiOrigin}/mcp`, {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    method: "POST",
  });
  return yield* authorizeMcpRequest(incoming, wikiOrigin).pipe(Effect.provideService(Auth, wiki));
});

const wikiDiscovery = Effect.fn("wikiDiscovery")(function* wikiDiscovery(path: string) {
  const { wiki } = yield* AuthApps;
  return yield* Effect.promise(async () =>
    wiki.instance.handler(new Request(new URL(path, wikiOrigin))),
  );
});

export {
  authorizedAccessToken,
  mcpRequest,
  startAuthorization,
  wikiAdministrator,
  wikiDiscovery,
  wikiOrigin,
};
