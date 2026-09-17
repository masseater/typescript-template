import { HTTP_FORBIDDEN, HTTP_OK } from "./browser-client.ts";
import {
  OWNER_EMAIL,
  issuedToken,
  mcpChallenge,
  mcpStatus,
  mcpUser,
} from "./wiki-oauth-fixture.ts";
import { bootstrapAdmin, setUserRole } from "@template/db/admin";
import { describe, expect } from "vite-plus/test";
import type { AuthFixture } from "./auth-test-fixture.ts";
import { createAuthTest } from "./auth-test-fixture.ts";
import { createTestDatabase } from "@template/db/testing";

type FixtureContext = Readonly<{ fixture: AuthFixture }>;

const it = createAuthTest({ bootstrapAdmin, createTestDatabase, setUserRole });
const HTTP_UNAUTHORIZED = 401;
const TAMPERED_SUFFIX = "xx";

describe("wiki OAuth discovery", () => {
  it("publishes OAuth discovery for its MCP resource", async ({ fixture }: FixtureContext) => {
    expect.hasAssertions();
    const wikiOrigin = fixture.origin("wiki");
    const wikiAuth = fixture.auth("wiki");
    const resource = await wikiAuth.handler(
      new Request(`${wikiOrigin}/.well-known/oauth-protected-resource/mcp`),
    );
    await expect(resource.json()).resolves.toMatchObject({
      authorization_servers: [`${wikiOrigin}/api/auth`],
      resource: `${wikiOrigin}/mcp`,
    });
    const server = await wikiAuth.handler(
      new Request(`${wikiOrigin}/.well-known/oauth-authorization-server/api/auth`),
    );
    await expect(server.json()).resolves.toMatchObject({
      code_challenge_methods_supported: ["S256"],
      issuer: `${wikiOrigin}/api/auth`,
      registration_endpoint: `${wikiOrigin}/api/auth/oauth2/register`,
    });
  });

  it("challenges MCP requests without a bearer token", async ({ fixture }: FixtureContext) => {
    expect.hasAssertions();
    const challenge = await fixture.authorizeMcp();
    expect(mcpStatus(challenge)).toBe(HTTP_UNAUTHORIZED);
    expect(mcpChallenge(challenge)).toContain(
      `resource_metadata="${fixture.origin("wiki")}/.well-known/oauth-protected-resource/mcp"`,
    );
  });
});

describe("wiki MCP authorization", () => {
  it("strong wiki administrator authorizes an MCP client that can then read the wiki", async ({
    fixture,
  }: FixtureContext) => {
    expect.hasAssertions();
    const { token } = await issuedToken(fixture);
    expect(mcpUser(await fixture.authorizeMcp(token))).toMatch(/^.+$/u);
    const tampered = `${token.slice(0, -TAMPERED_SUFFIX.length)}${TAMPERED_SUFFIX}`;
    expect(mcpStatus(await fixture.authorizeMcp(tampered))).toBe(HTTP_UNAUTHORIZED);
  });

  it("demoted administrator loses MCP access even with an unexpired token", async ({
    fixture,
  }: FixtureContext) => {
    expect.hasAssertions();
    const { token, wiki } = await issuedToken(fixture);
    expect(mcpStatus(await fixture.authorizeMcp(token))).toBe(HTTP_OK);
    await fixture.registerVerified("second@example.com");
    await fixture.changeRole("second@example.com", "admin");
    await fixture.changeRole(OWNER_EMAIL, "user");
    await expect(fixture.verify({ audience: "wiki", headers: wiki.headers() })).rejects.toThrow(
      "SESSION_REQUIRED",
    );
    expect(mcpStatus(await fixture.authorizeMcp(token))).toBe(HTTP_FORBIDDEN);
  });
});
