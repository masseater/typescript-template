import { assert, it } from "@effect/vitest";
import { runStatement } from "@template/db/testing";
import { Effect } from "effect";

import {
  Fixture,
  HTTP_FORBIDDEN,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  PASSWORD,
  TEST_TIMEOUT,
  bootstrapVerifiedAdmin,
  failureTag,
  registerVerified,
  signIn,
  signInAs,
  withAuth,
} from "./auth-test-fixture.ts";
import { BrowserClient } from "./browser-client.ts";
import {
  exchangeCode,
  grantAuthorization,
  mcpRequest,
  responseStatus,
  startAuthorization,
  wikiAdministrator,
  wikiOrigin,
} from "./wiki-oauth-fixture.ts";

const tamperedSuffix = "xx";

const discovery = Effect.fn("discovery")(function* discovery(path: string) {
  const { wiki } = yield* Fixture;
  const response = yield* Effect.promise(async () =>
    wiki.instance.handler(new Request(`${wikiOrigin}${path}`)),
  );
  const body = yield* Effect.promise(async (): Promise<unknown> => response.json());
  return { body, status: response.status };
});

const authorizedTokens = Effect.fn("authorizedTokens")(function* authorizedTokens() {
  const flow = yield* startAuthorization();
  const wiki = yield* wikiAdministrator("owner@example.com");
  const code = yield* grantAuthorization(wiki, flow.oauthQuery);
  return { tokens: yield* exchangeCode(flow, code), wiki };
});

it.effect(
  "wiki publishes OAuth discovery for its MCP resource",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const resource = yield* discovery("/.well-known/oauth-protected-resource/mcp");
        assert.strictEqual(resource.status, HTTP_OK);
        assert.deepInclude(resource.body, {
          authorization_servers: [`${wikiOrigin}/api/auth`],
          resource: `${wikiOrigin}/mcp`,
        });
        const server = yield* discovery("/.well-known/oauth-authorization-server/api/auth");
        assert.deepInclude(server.body, {
          code_challenge_methods_supported: ["S256"],
          issuer: `${wikiOrigin}/api/auth`,
          registration_endpoint: `${wikiOrigin}/api/auth/oauth2/register`,
        });
        const challenge = yield* mcpRequest();
        assert.strictEqual(responseStatus(challenge), HTTP_UNAUTHORIZED);
        const header =
          challenge instanceof Response ? challenge.headers.get("www-authenticate") : "";
        const metadata = `resource_metadata="${wikiOrigin}/.well-known/oauth-protected-resource/mcp"`;
        assert.include(header ?? "", metadata);
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "strong wiki administrator authorizes an MCP client that can then read the wiki",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const { tokens } = yield* authorizedTokens();
        const granted = yield* mcpRequest(tokens.access_token);
        assert.match(granted instanceof Response ? "" : granted.userId, /^.+$/u);
        const token = tokens.access_token;
        const tampered = `${token.slice(0, token.length - tamperedSuffix.length)}${tamperedSuffix}`;
        assert.strictEqual(responseStatus(yield* mcpRequest(tampered)), HTTP_UNAUTHORIZED);
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "demoted administrator loses MCP access even with an unexpired token",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const { tokens, wiki } = yield* authorizedTokens();
        const owner = yield* wiki.verify();
        yield* registerVerified("second@example.com");
        yield* runStatement("UPDATE user SET role = 'admin' WHERE email = ?", "second@example.com");
        yield* runStatement("UPDATE user SET role = 'user' WHERE id = ?", owner.user.id);
        assert.strictEqual(yield* failureTag(wiki.verify()), "SessionRequired");
        assert.strictEqual(responseStatus(yield* mcpRequest(tokens.access_token)), HTTP_FORBIDDEN);
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "weak or non-administrator wiki sessions cannot grant MCP access",
  () =>
    withAuth(
      Effect.gen(function* program() {
        const flow = yield* startAuthorization();
        yield* bootstrapVerifiedAdmin("owner@example.com");
        const weak = yield* signInAs("wiki", "owner@example.com");
        const continued = yield* weak.json("/oauth2/continue", {
          oauth_query: flow.oauthQuery,
          postLogin: true,
        });
        assert.strictEqual(continued.status, HTTP_FORBIDDEN);
        assert.deepInclude(continued.body, { message: "ADMIN_MFA_REQUIRED" });
        const smuggled = yield* new BrowserClient((yield* Fixture).wiki).json("/sign-in/email", {
          email: "owner@example.com",
          oauth_query: flow.oauthQuery,
          password: PASSWORD,
        });
        assert.strictEqual(smuggled.status, HTTP_FORBIDDEN);
        assert.deepInclude(smuggled.body, { message: "OAUTH_QUERY_NOT_ACCEPTED" });
      }),
    ),
  TEST_TIMEOUT,
);

it.effect(
  "non-administrator wiki members cannot sign in or sign up",
  () =>
    withAuth(
      Effect.gen(function* program() {
        yield* registerVerified("member@example.com");
        const member = new BrowserClient((yield* Fixture).wiki);
        assert.isFalse((yield* signIn(member, "member@example.com")).ok);
        const signUp = { email: "new@example.com", name: "new", password: PASSWORD };
        assert.isFalse((yield* member.request("/sign-up/email", signUp)).ok);
      }),
    ),
  TEST_TIMEOUT,
);
