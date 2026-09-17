import { HTTP_FORBIDDEN, HTTP_OK, PASSWORD } from "./browser-client.ts";
import { OWNER_EMAIL, startAuthorization } from "./wiki-oauth-fixture.ts";
import { bootstrapAdmin, setUserRole } from "@template/db/admin";
import { describe, expect } from "vite-plus/test";
import type { AuthFixture } from "./auth-test-fixture.ts";
import { createAuthTest } from "./auth-test-fixture.ts";
import { createTestDatabase } from "@template/db/testing";

type FixtureContext = Readonly<{ fixture: AuthFixture }>;

const it = createAuthTest({ bootstrapAdmin, createTestDatabase, setUserRole });

describe("wiki sign-in restrictions", () => {
  it("wiki sign-in never sends a verification email it has no page for", async ({
    fixture,
  }: FixtureContext) => {
    expect.hasAssertions();
    const email = "pending@example.com";
    await fixture.register(email);
    fixture.forgetMail(email);
    const wikiSignIn = await fixture
      .client("wiki")
      .request("/sign-in/email", { email, password: PASSWORD });
    expect({ mailed: fixture.hasMail(email), status: wikiSignIn.status }).toStrictEqual({
      mailed: false,
      status: HTTP_FORBIDDEN,
    });
    const userSignIn = await fixture
      .client("user")
      .request("/sign-in/email", { email, password: PASSWORD });
    expect({ mailed: fixture.hasMail(email), status: userSignIn.status }).toStrictEqual({
      mailed: true,
      status: HTTP_FORBIDDEN,
    });
  });

  it("non-administrators cannot sign in or sign up to the wiki", async ({
    fixture,
  }: FixtureContext) => {
    expect.hasAssertions();
    await fixture.registerVerified("member@example.com");
    const member = fixture.client("wiki");
    const signIn = await member.request("/sign-in/email", {
      email: "member@example.com",
      password: PASSWORD,
    });
    const signUp = await member.request("/sign-up/email", {
      email: "new@example.com",
      name: "new",
      password: PASSWORD,
    });
    expect({ signIn: signIn.ok, signUp: signUp.ok }).toStrictEqual({
      signIn: false,
      signUp: false,
    });
  });
});

describe("wiki MCP grant restrictions", () => {
  it("weak wiki administrator sessions cannot grant MCP access", async ({
    fixture,
  }: FixtureContext) => {
    expect.hasAssertions();
    const flow = await startAuthorization(fixture);
    await fixture.registerAdmin(OWNER_EMAIL);
    const weak = fixture.client("wiki");
    const signIn = await weak.request("/sign-in/email", { email: OWNER_EMAIL, password: PASSWORD });
    expect(signIn.status).toBe(HTTP_OK);
    const continued = await weak.request("/oauth2/continue", {
      oauth_query: flow.oauthQuery,
      postLogin: true,
    });
    expect(continued.status).toBe(HTTP_FORBIDDEN);
    await expect(continued.json()).resolves.toMatchObject({ message: "ADMIN_MFA_REQUIRED" });
  });

  it("oauth queries cannot be smuggled into sign-in", async ({ fixture }: FixtureContext) => {
    expect.hasAssertions();
    const flow = await startAuthorization(fixture);
    await fixture.registerAdmin(OWNER_EMAIL);
    const smuggled = await fixture.client("wiki").request("/sign-in/email", {
      email: OWNER_EMAIL,
      oauth_query: flow.oauthQuery,
      password: PASSWORD,
    });
    expect(smuggled.status).toBe(HTTP_FORBIDDEN);
    await expect(smuggled.json()).resolves.toMatchObject({ message: "OAUTH_QUERY_NOT_ACCEPTED" });
  });
});
