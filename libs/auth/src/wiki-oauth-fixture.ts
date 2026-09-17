import { HTTP_OK, PASSWORD, enableTotp } from "./browser-client.ts";
import { object, parse, string } from "valibot";
import type { AuthFixture } from "./auth-test-fixture.ts";
import type { BrowserClient } from "./browser-client.ts";
import { expect } from "vite-plus/test";

interface AuthorizationFlow {
  readonly clientId: string;
  readonly oauthQuery: string;
  readonly verifier: string;
}

type McpResult =
  | Readonly<{ headers: Readonly<Pick<Headers, "get">>; status: number }>
  | Readonly<{ userId: string }>;

const HTTP_CREATED = 201;
const HTTP_FOUND = 302;
const VERIFIER_BYTES = 32;
const OWNER_EMAIL = "owner@example.com";
const redirectUri = "http://127.0.0.1:43123/callback";
const redirectSchema = object({ url: string() });

function base64url(bytes: readonly number[]): string {
  return Buffer.from(bytes).toString("base64url");
}

async function wikiAdministrator(fixture: AuthFixture): Promise<BrowserClient> {
  await fixture.registerAdmin(OWNER_EMAIL);
  const admin = fixture.client("admin");
  await admin.request("/sign-in/email", { email: OWNER_EMAIL, password: PASSWORD });
  const { authenticator } = await enableTotp(admin);
  const wiki = fixture.client("wiki");
  const signIn = await wiki.request("/sign-in/email", { email: OWNER_EMAIL, password: PASSWORD });
  await expect(signIn.json()).resolves.toMatchObject({ twoFactorRedirect: true });
  const verified = await wiki.request("/two-factor/verify-totp", {
    code: authenticator.generate(),
  });
  expect(verified.status).toBe(HTTP_OK);
  return wiki;
}

async function registerClient(fixture: AuthFixture): Promise<string> {
  const registration = await fixture.client("wiki").request("/oauth2/register", {
    client_name: "Test MCP client",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [redirectUri],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
  expect(registration.status).toBe(HTTP_CREATED);
  return parse(object({ client_id: string() }), await registration.json()).client_id;
}

async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url([...new Uint8Array(digest)]);
}

async function authorizationUrl(
  wikiOrigin: string,
  clientId: string,
  verifier: string,
): Promise<string> {
  const authorize = new URL(`${wikiOrigin}/api/auth/oauth2/authorize`);
  authorize.search = new URLSearchParams({
    client_id: clientId,
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    resource: `${wikiOrigin}/mcp`,
    response_type: "code",
    scope: "wiki:read offline_access",
    state: "state-value",
  }).toString();
  return authorize.href;
}

async function startAuthorization(fixture: AuthFixture): Promise<AuthorizationFlow> {
  const wikiOrigin = fixture.origin("wiki");
  const clientId = await registerClient(fixture);
  const random = crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES));
  const verifier = base64url([...random]);
  const redirect = await fixture
    .client("wiki")
    .navigate(await authorizationUrl(wikiOrigin, clientId, verifier));
  expect(redirect.status).toBe(HTTP_FOUND);
  const login = new URL(redirect.headers.get("location") ?? "", wikiOrigin);
  expect(login.pathname).toBe("/login");
  return { clientId, oauthQuery: login.search.slice(1), verifier };
}

async function continueToConsent(
  fixture: AuthFixture,
  wiki: Readonly<BrowserClient>,
  oauthQuery: string,
): Promise<string> {
  const continued = await wiki.request("/oauth2/continue", {
    oauth_query: oauthQuery,
    postLogin: true,
  });
  expect(continued.status).toBe(HTTP_OK);
  const next = new URL(parse(redirectSchema, await continued.json()).url, fixture.origin("wiki"));
  expect(next.pathname).toBe("/consent");
  return next.search.slice(1);
}

async function grantAuthorization(
  fixture: AuthFixture,
  wiki: Readonly<BrowserClient>,
  oauthQuery: string,
): Promise<string> {
  const consentQuery = await continueToConsent(fixture, wiki, oauthQuery);
  const consented = await wiki.request("/oauth2/consent", {
    accept: true,
    oauth_query: consentQuery,
  });
  expect(consented.status).toBe(HTTP_OK);
  const callback = new URL(parse(redirectSchema, await consented.json()).url);
  expect({
    state: callback.searchParams.get("state"),
    target: `${callback.origin}${callback.pathname}`,
  }).toStrictEqual({ state: "state-value", target: redirectUri });
  const code = callback.searchParams.get("code");
  if (code === null) {
    throw new Error("AUTHORIZATION_CODE_MISSING");
  }
  return code;
}

async function exchangeCode(
  fixture: AuthFixture,
  flow: AuthorizationFlow,
  code: string,
): Promise<string> {
  const wikiOrigin = fixture.origin("wiki");
  const response = await fixture.auth("wiki").handler(
    new Request(`${wikiOrigin}/api/auth/oauth2/token`, {
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
    }),
  );
  expect(response.status).toBe(HTTP_OK);
  return parse(object({ access_token: string() }), await response.json()).access_token;
}

async function issuedToken(
  fixture: AuthFixture,
): Promise<Readonly<{ token: string; wiki: BrowserClient }>> {
  const flow = await startAuthorization(fixture);
  const wiki = await wikiAdministrator(fixture);
  const code = await grantAuthorization(fixture, wiki, flow.oauthQuery);
  return { token: await exchangeCode(fixture, flow, code), wiki };
}

function mcpStatus(result: McpResult): number {
  return "status" in result ? result.status : HTTP_OK;
}

function mcpUser(result: McpResult): string {
  if ("status" in result) {
    throw new TypeError(`MCP_ACCESS_DENIED_${result.status}`);
  }
  return result.userId;
}

function mcpChallenge(result: McpResult): string | null {
  if (!("headers" in result)) {
    throw new Error("CHALLENGE_EXPECTED");
  }
  return result.headers.get("www-authenticate");
}

export { OWNER_EMAIL, issuedToken, mcpChallenge, mcpStatus, mcpUser, startAuthorization };
