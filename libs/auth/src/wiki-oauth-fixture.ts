import { assert } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  Fixture,
  HTTP_CREATED,
  HTTP_FOUND,
  HTTP_OK,
  PASSWORD,
  bootstrapVerifiedAdmin,
  decodeOrDie,
  enableTotp,
  signInAs,
} from "./auth-test-fixture.ts";
import { Auth } from "./auth.ts";
import { BrowserClient, origins } from "./browser-client.ts";
import { authorizeMcpRequest } from "./mcp.ts";

interface AuthorizationFlow {
  readonly clientId: string;
  readonly oauthQuery: string;
  readonly verifier: string;
}

const wikiOrigin = origins["internal-dashboard"];
const redirectUri = "http://127.0.0.1:43123/callback";
const VERIFIER_BYTES = 32;
const Redirect = Schema.Struct({ url: Schema.String });
const Registration = Schema.Struct({ client_id: Schema.String });
const Tokens = Schema.Struct({ access_token: Schema.String });

function base64url(bytes: Readonly<Uint8Array>): string {
  return Buffer.from(bytes).toString("base64url");
}

function responseStatus(value: unknown): number | undefined {
  return value instanceof Response ? value.status : undefined;
}

const wikiAdministrator = Effect.fn("wikiAdministrator")(function* wikiAdministrator(
  email: string,
) {
  yield* bootstrapVerifiedAdmin(email);
  const { authenticator } = yield* enableTotp(yield* signInAs("service-admin", email));
  const wiki = new BrowserClient((yield* Fixture)["internal-dashboard"]);
  const challenge = yield* wiki.json("/sign-in/email", { email, password: PASSWORD });
  assert.deepInclude(challenge.body, { twoFactorRedirect: true });
  const verified = yield* wiki.request("/two-factor/verify-totp", {
    code: authenticator.generate(),
  });
  assert.strictEqual(verified.status, HTTP_OK);
  return wiki;
});

const pkceChallenge = Effect.fn("pkceChallenge")(function* pkceChallenge(verifier: string) {
  const digest = yield* Effect.promise(async () =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
  );
  return base64url(new Uint8Array(digest));
});

function authorizeUrl(clientId: string, challenge: string): URL {
  const authorize = new URL(`${wikiOrigin}/api/auth/oauth2/authorize`);
  for (const [key, value] of Object.entries({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    resource: `${wikiOrigin}/mcp`,
    response_type: "code",
    scope: "wiki:read offline_access",
    state: "state-value",
  })) {
    authorize.searchParams.set(key, value);
  }
  return authorize;
}

const registerClient = Effect.fn("registerClient")(function* registerClient(
  anonymous: Readonly<BrowserClient>,
) {
  const registration = yield* anonymous.json("/oauth2/register", {
    client_name: "Test MCP client",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [redirectUri],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
  assert.strictEqual(registration.status, HTTP_CREATED);
  return (yield* decodeOrDie(Registration, registration.body)).client_id;
});

const startAuthorization = Effect.fn("startAuthorization")(function* startAuthorization() {
  const anonymous = new BrowserClient((yield* Fixture)["internal-dashboard"]);
  const clientId = yield* registerClient(anonymous);
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)));
  const authorize = authorizeUrl(clientId, yield* pkceChallenge(verifier));
  const redirect = yield* anonymous.navigate(authorize.href);
  assert.strictEqual(redirect.status, HTTP_FOUND);
  const login = new URL(redirect.headers.get("location") ?? "", wikiOrigin);
  assert.strictEqual(login.pathname, "/login");
  const flow: AuthorizationFlow = { clientId, oauthQuery: login.search.slice(1), verifier };
  return flow;
});

const grantAuthorization = Effect.fn("grantAuthorization")(function* grantAuthorization(
  wiki: Readonly<BrowserClient>,
  oauthQuery: string,
) {
  const continued = yield* wiki.json("/oauth2/continue", {
    oauth_query: oauthQuery,
    postLogin: true,
  });
  assert.strictEqual(continued.status, HTTP_OK);
  const next = new URL((yield* decodeOrDie(Redirect, continued.body)).url, wikiOrigin);
  assert.strictEqual(next.pathname, "/consent");
  const consented = yield* wiki.json("/oauth2/consent", {
    accept: true,
    oauth_query: next.search.slice(1),
  });
  assert.strictEqual(consented.status, HTTP_OK);
  const callback = new URL((yield* decodeOrDie(Redirect, consented.body)).url);
  assert.strictEqual(`${callback.origin}${callback.pathname}`, redirectUri);
  assert.strictEqual(callback.searchParams.get("state"), "state-value");
  return callback.searchParams.get("code") ?? "";
});

const exchangeCode = Effect.fn("exchangeCode")(function* exchangeCode(
  flow: AuthorizationFlow,
  code: string,
) {
  const wiki = (yield* Fixture)["internal-dashboard"];
  const body = new URLSearchParams({
    client_id: flow.clientId,
    code,
    code_verifier: flow.verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    resource: `${wikiOrigin}/mcp`,
  });
  const request = new Request(`${wikiOrigin}/api/auth/oauth2/token`, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const response = yield* Effect.promise(async () => wiki.instance.handler(request));
  assert.strictEqual(response.status, HTTP_OK);
  return yield* decodeOrDie(
    Tokens,
    yield* Effect.promise(async (): Promise<unknown> => response.json()),
  );
});

const mcpRequest = Effect.fn("mcpRequest")(function* mcpRequest(token?: string) {
  const wiki = (yield* Fixture)["internal-dashboard"];
  const request = new Request(`${wikiOrigin}/mcp`, {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
    method: "POST",
  });
  return yield* authorizeMcpRequest(request, wikiOrigin).pipe(Effect.provideService(Auth, wiki));
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
