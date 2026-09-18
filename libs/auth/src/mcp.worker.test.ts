import "@template/dont-review-it/vitest/parsed-fields";
import { runStatement } from "@template/db/testing";
import { Effect } from "effect";
import { describe, expect } from "vite-plus/test";

import {
  authTest,
  authorizedAccessToken,
  mcpRequest,
  registerVerified,
  runWith,
  wikiDiscovery,
  wikiOrigin,
} from "./testing.ts";

const discoveryHeaders = {
  "cache-control": "public, max-age=15, stale-while-revalidate=15, stale-if-error=86400",
  "content-type": "application/json",
};
const clientAuthenticationMethods = [
  "client_secret_basic",
  "client_secret_post",
  "private_key_jwt",
];
const signingAlgorithms = [
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
  "EdDSA",
];
const challengeHeaders = {
  "cache-control": "no-store",
  "content-type": "application/json",
  "www-authenticate": `Bearer resource_metadata="${wikiOrigin}/.well-known/oauth-protected-resource/mcp", scope="wiki:read"`,
};

describe("authorizeMcpRequest", () => {
  describe("the wiki OAuth discovery", () => {
    const it = authTest
      .extend("protectedResource", async ({ auth }) =>
        runWith(auth, () => wikiDiscovery("/.well-known/oauth-protected-resource/mcp")),
      )
      .extend("authorizationServer", async ({ auth }) =>
        runWith(auth, () => wikiDiscovery("/.well-known/oauth-authorization-server/api/auth")),
      );

    it("describes the MCP resource", async ({ protectedResource }) => {
      await expect(protectedResource).toHaveParsedFields({
        body: {
          authorization_servers: [`${wikiOrigin}/api/auth`],
          bearer_methods_supported: ["header"],
          dpop_signing_alg_values_supported: ["EdDSA", "ES256", "ES512", "PS256", "RS256"],
          resource: `${wikiOrigin}/mcp`,
          scopes_supported: ["wiki:read"],
        },
        headers: discoveryHeaders,
        status: 200,
      });
    });

    it("describes the authorization server", async ({ authorizationServer }) => {
      await expect(authorizationServer).toHaveParsedFields({
        body: {
          authorization_endpoint: `${wikiOrigin}/api/auth/oauth2/authorize`,
          authorization_response_iss_parameter_supported: true,
          backchannel_logout_session_supported: true,
          backchannel_logout_supported: true,
          code_challenge_methods_supported: ["S256"],
          dpop_signing_alg_values_supported: ["EdDSA", "ES256", "ES512", "PS256", "RS256"],
          grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
          introspection_endpoint: `${wikiOrigin}/api/auth/oauth2/introspect`,
          introspection_endpoint_auth_methods_supported: clientAuthenticationMethods,
          introspection_endpoint_auth_signing_alg_values_supported: signingAlgorithms,
          issuer: `${wikiOrigin}/api/auth`,
          jwks_uri: `${wikiOrigin}/api/auth/jwks`,
          registration_endpoint: `${wikiOrigin}/api/auth/oauth2/register`,
          response_modes_supported: ["query"],
          response_types_supported: ["code"],
          revocation_endpoint: `${wikiOrigin}/api/auth/oauth2/revoke`,
          revocation_endpoint_auth_methods_supported: clientAuthenticationMethods,
          revocation_endpoint_auth_signing_alg_values_supported: signingAlgorithms,
          scopes_supported: ["wiki:read", "offline_access"],
          token_endpoint: `${wikiOrigin}/api/auth/oauth2/token`,
          token_endpoint_auth_methods_supported: ["none", ...clientAuthenticationMethods],
          token_endpoint_auth_signing_alg_values_supported: signingAlgorithms,
        },
        headers: discoveryHeaders,
        status: 200,
      });
    });
  });

  describe("a request without a bearer token", () => {
    const it = authTest.extend("challenge", async ({ auth }) => runWith(auth, () => mcpRequest()));

    it("is challenged toward the resource metadata", async ({ challenge }) => {
      await expect(challenge).toHaveParsedFields({
        body: {
          error: { code: -32_000, message: "BEARER_TOKEN_REQUIRED" },
          id: null,
          jsonrpc: "2.0",
        },
        headers: challengeHeaders,
        status: 401,
      });
    });
  });

  describe("a token granted by a strong wiki administrator", () => {
    const it = authTest
      .extend("reader", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* readWiki() {
            return yield* mcpRequest(yield* authorizedAccessToken("owner@example.com"));
          }),
        ),
      )
      .extend("tampered", async ({ auth }) =>
        runWith(auth, () =>
          Effect.gen(function* tamper() {
            const token = yield* authorizedAccessToken("owner@example.com");
            return yield* mcpRequest(`${token.slice(0, -2)}xx`);
          }),
        ),
      );

    it("reads the wiki as that administrator", ({ reader }) => {
      expect(reader).toStrictEqual({ userId: "user-1" });
    });

    it("is refused once tampered", async ({ tampered }) => {
      await expect(tampered).toHaveParsedFields({
        body: {
          error: { code: -32_000, message: "ACCESS_TOKEN_INVALID" },
          id: null,
          jsonrpc: "2.0",
        },
        headers: challengeHeaders,
        status: 401,
      });
    });
  });

  describe("a token of an administrator demoted afterwards", () => {
    const it = authTest.extend("demoted", async ({ auth }) =>
      runWith(auth, () =>
        Effect.gen(function* demote() {
          const token = yield* authorizedAccessToken("owner@example.com");
          yield* registerVerified("second@example.com");
          yield* runStatement(
            "UPDATE user SET role = 'admin' WHERE email = ?",
            "second@example.com",
          );
          yield* runStatement("UPDATE user SET role = 'user' WHERE email = ?", "owner@example.com");
          return yield* mcpRequest(token);
        }),
      ),
    );

    it("no longer reads the wiki", async ({ demoted }) => {
      await expect(demoted).toHaveParsedFields({
        body: {
          error: { code: -32_000, message: "WIKI_READER_REQUIRED" },
          id: null,
          jsonrpc: "2.0",
        },
        headers: { "cache-control": "no-store", "content-type": "application/json" },
        status: 403,
      });
    });
  });
});
