import { sendVerificationEmail } from "@template/config";
import { createDb } from "@template/db";
import { bootstrapAdmin, setUserRole } from "@template/db/admin";
import { createTestDatabase, getSchemaShape } from "@template/db/testing";
import { getSchema } from "better-auth/db";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { URI } from "otpauth";
import * as v from "valibot";
import { expect, expectTypeOf, test as baseTest } from "vite-plus/test";
import { createAuth, verifySession } from "./index.ts";
import type { Auth } from "./index.ts";
import { authorizeMcpRequest } from "./mcp.ts";

const password = "test-password-safe-123";
const secret = "integration-test-secret-at-least-32-characters-long";
const mailConfig = {
  EMAIL_FROM: "no-reply@example.test",
  MAILPIT_URL: "http://127.0.0.1:8025",
};

type MailpitMessage = {
  From: { Email: string };
  To: { Email: string }[];
  Subject: string;
  Text: string;
};

class BrowserClient {
  readonly cookies = new Map<string, string>();
  readonly auth: Auth;
  readonly origin: string;

  constructor(auth: Auth, origin: string) {
    this.auth = auth;
    this.origin = origin;
  }

  headers() {
    return new Headers({
      origin: this.origin,
      cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "),
    });
  }

  async request(endpoint: string, body?: Record<string, unknown>) {
    const headers = this.headers();
    headers.set("content-type", "application/json");
    return this.send(
      new Request(`${this.origin}/api/auth${endpoint}`, {
        method: body ? "POST" : "GET",
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  }

  async navigate(url: string) {
    const headers = this.headers();
    headers.set("accept", "text/html");
    return this.send(new Request(url, { headers, redirect: "manual" }));
  }

  async send(request: Request) {
    const response = await this.auth.handler(request);
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      if (!pair) continue;
      const separator = pair.indexOf("=");
      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      if (value) this.cookies.set(key, value);
      else this.cookies.delete(key);
    }
    return response;
  }
}

async function createFixture() {
  const db = await createTestDatabase();
  const database = createDb(db.binding);
  const mailbox = new Map<string, string>();
  const mailServer = setupServer(
    http.post<never, MailpitMessage>(
      `${mailConfig.MAILPIT_URL}/api/v1/send`,
      async ({ request }) => {
        const message = await request.json();
        if (
          message.From.Email !== mailConfig.EMAIL_FROM ||
          message.Subject !== "メールアドレスの確認"
        )
          return HttpResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
        const url = message.Text.split("\n").find((line) => line.startsWith("http://"));
        if (!url) return HttpResponse.json({ error: "VERIFICATION_URL_REQUIRED" }, { status: 400 });
        for (const recipient of message.To) mailbox.set(recipient.Email, url);
        return HttpResponse.json({ ID: crypto.randomUUID() });
      },
    ),
  );
  mailServer.listen({ onUnhandledRequest: "error" });
  const userAuth = createAuth({
    database,
    secret,
    baseURL: "http://localhost:4101",
    audience: "user",
    sendVerificationEmail: (message) =>
      sendVerificationEmail({ ...mailConfig, APP_ORIGIN: "http://localhost:4101" }, message),
  });
  const adminAuth = createAuth({
    database,
    secret,
    baseURL: "http://localhost:4102",
    audience: "admin",
    sendVerificationEmail: (message) =>
      sendVerificationEmail({ ...mailConfig, APP_ORIGIN: "http://localhost:4102" }, message),
  });
  const wikiAuth = createAuth({
    database,
    secret,
    baseURL: "http://localhost:4103",
    audience: "wiki",
    sendVerificationEmail: (message) =>
      sendVerificationEmail({ ...mailConfig, APP_ORIGIN: "http://localhost:4103" }, message),
  });
  await wikiAuth.$context;
  const register = async (email: string) => {
    const client = new BrowserClient(userAuth, "http://localhost:4101");
    const response = await client.request("/sign-up/email", { name: email, email, password });
    if (!response.ok) throw new Error(`Registration failed: ${response.status}`);
    return client;
  };
  const verifyEmail = async (email: string) => {
    const url = mailbox.get(email);
    if (!url) throw new Error("MAIL_DELIVERY_INVALID");
    const link = new URL(url);
    expect(link.pathname).toBe("/verify-email");
    expect(link.search).toBe("");
    const token = new URLSearchParams(link.hash.slice(1)).get("token");
    if (!token) throw new Error("VERIFICATION_TOKEN_MISSING");
    await userAuth.api.verifyEmail({ query: { token } });
  };
  return {
    database,
    binding: db.binding,
    userAuth,
    adminAuth,
    wikiAuth,
    register,
    verifyEmail,
    dispose: async () => {
      mailServer.close();
      await db.dispose();
    },
  };
}

type Fixture = Awaited<ReturnType<typeof createFixture>>;
const test = baseTest.extend<{ fixture: Fixture }>({
  fixture: async ({}, provide) => {
    const fixture = await createFixture();
    try {
      await provide(fixture);
    } finally {
      await fixture.dispose();
    }
  },
});

async function enableTotp(client: BrowserClient) {
  const response = await client.request("/two-factor/enable", { password });
  expect(response.status).toBe(200);
  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("totpURI" in data) ||
    typeof data.totpURI !== "string" ||
    !("backupCodes" in data) ||
    !Array.isArray(data.backupCodes) ||
    !data.backupCodes.every((code: unknown): code is string => typeof code === "string")
  ) {
    throw new Error("TOTP_ENROLLMENT_FAILED");
  }
  const authenticator = URI.parse(data.totpURI);
  const verified = await client.request("/two-factor/verify-totp", {
    code: authenticator.generate(),
  });
  expect(verified.status).toBe(200);
  return { authenticator, backupCodes: data.backupCodes };
}

test("requires an actual email verification before password login", async ({ fixture }) => {
  const client = await fixture.register("alice@example.com");
  expect(
    (await client.request("/sign-in/email", { email: "alice@example.com", password })).status,
  ).toBe(403);
  await fixture.verifyEmail("alice@example.com");
  expect(
    (await client.request("/sign-in/email", { email: "alice@example.com", password })).status,
  ).toBe(200);
  const current = await verifySession({
    auth: fixture.userAuth,
    database: fixture.database,
    headers: client.headers(),
    audience: "user",
  });
  expect(current.user.emailVerified).toBe(true);
  expectTypeOf(current.user.twoFactorEnabled).toEqualTypeOf<boolean>();
  expect(current.user.twoFactorEnabled).toBe(false);
  expect(current.strong).toBe(false);
});

test("admin enrollment session cannot access CRM until real TOTP verification", async ({
  fixture,
}) => {
  await fixture.register("admin@example.com");
  await fixture.verifyEmail("admin@example.com");
  await bootstrapAdmin(fixture.database, "admin@example.com");
  const client = new BrowserClient(fixture.adminAuth, "http://localhost:4102");
  expect(
    (await client.request("/sign-in/email", { email: "admin@example.com", password })).status,
  ).toBe(200);
  const verify = {
    auth: fixture.adminAuth,
    database: fixture.database,
    headers: client.headers(),
    audience: "admin" as const,
  };
  await expect(verifySession(verify)).rejects.toThrow("ADMIN_MFA_REQUIRED");
  expect((await verifySession({ ...verify, allowEnrollment: true })).strong).toBe(false);
  await enableTotp(client);
  expect((await verifySession({ ...verify, headers: client.headers() })).strong).toBe(true);
});

test("TOTP sign-in has no usable session until valid second factor", async ({ fixture }) => {
  const client = await fixture.register("totp@example.com");
  await fixture.verifyEmail("totp@example.com");
  await client.request("/sign-in/email", { email: "totp@example.com", password });
  const { authenticator } = await enableTotp(client);
  await client.request("/sign-out", {});
  const signIn = await client.request("/sign-in/email", { email: "totp@example.com", password });
  expect(await signIn.json()).toMatchObject({ twoFactorRedirect: true });
  await expect(
    verifySession({
      auth: fixture.userAuth,
      database: fixture.database,
      headers: client.headers(),
      audience: "user",
    }),
  ).rejects.toThrow("SESSION_REQUIRED");
  expect((await client.request("/two-factor/verify-totp", { code: "invalid-code" })).ok).toBe(
    false,
  );
  expect(
    (await client.request("/two-factor/verify-totp", { code: authenticator.generate() })).status,
  ).toBe(200);
  expect(
    (
      await verifySession({
        auth: fixture.userAuth,
        database: fixture.database,
        headers: client.headers(),
        audience: "user",
      })
    ).strong,
  ).toBe(true);
});

test("shared signing secret cannot turn a user session into admin session", async ({ fixture }) => {
  const client = await fixture.register("admin@example.com");
  await fixture.verifyEmail("admin@example.com");
  await bootstrapAdmin(fixture.database, "admin@example.com");
  await client.request("/sign-in/email", { email: "admin@example.com", password });
  const forged = new Headers({
    cookie: client.headers().get("cookie")?.replaceAll("template-user", "template-admin") ?? "",
  });
  await expect(
    verifySession({
      auth: fixture.adminAuth,
      database: fixture.database,
      headers: forged,
      audience: "admin",
      allowEnrollment: true,
    }),
  ).rejects.toThrow("SESSION_INVALID");
});

test("shared signing secret cannot transfer a pending TOTP challenge across apps", async ({
  fixture,
}) => {
  const client = await fixture.register("admin@example.com");
  await fixture.verifyEmail("admin@example.com");
  await bootstrapAdmin(fixture.database, "admin@example.com");
  await client.request("/sign-in/email", { email: "admin@example.com", password });
  const { authenticator } = await enableTotp(client);
  await client.request("/sign-out", {});
  await client.request("/sign-in/email", { email: "admin@example.com", password });
  const admin = new BrowserClient(fixture.adminAuth, "http://localhost:4102");
  for (const [key, value] of client.cookies)
    admin.cookies.set(key.replace("template-user", "template-admin"), value);
  const response = await admin.request("/two-factor/verify-totp", {
    code: authenticator.generate(),
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ message: "CHALLENGE_AUDIENCE_INVALID" });
});

test("HTTP inputs cannot self-assign role, audience or authentication strength", async ({
  fixture,
}) => {
  const client = await fixture.register("reader@example.com");
  await fixture.verifyEmail("reader@example.com");
  await client.request("/sign-in/email", { email: "reader@example.com", password });
  await client.request("/update-user", { role: "admin", securityVersion: 99 });
  await client.request("/update-session", {
    audience: "admin",
    authenticationMethod: "passkey_uv",
  });
  const current = await verifySession({
    auth: fixture.userAuth,
    database: fixture.database,
    headers: client.headers(),
    audience: "user",
  });
  expect(current.user.role).toBe("user");
  expect(current.session.audience).toBe("user");
  expect(current.strong).toBe(false);
});

test("admin cannot publicly register and user auth has no admin endpoints", async ({ fixture }) => {
  const admin = new BrowserClient(fixture.adminAuth, "http://localhost:4102");
  expect(
    (await admin.request("/sign-up/email", { name: "admin", email: "admin@example.com", password }))
      .ok,
  ).toBe(false);
  const user = new BrowserClient(fixture.userAuth, "http://localhost:4101");
  expect((await user.request("/admin/list-users")).status).toBe(404);
  expect((await user.request("/admin/set-role", { userId: "x", role: "admin" })).status).toBe(404);
});

test("revocation invalidates an actual HTTP session", async ({ fixture }) => {
  await fixture.register("owner@example.com");
  await fixture.verifyEmail("owner@example.com");
  await bootstrapAdmin(fixture.database, "owner@example.com");
  const admin = new BrowserClient(fixture.adminAuth, "http://localhost:4102");
  await admin.request("/sign-in/email", { email: "owner@example.com", password });
  await enableTotp(admin);
  const authority = await verifySession({
    auth: fixture.adminAuth,
    database: fixture.database,
    headers: admin.headers(),
    audience: "admin",
  });
  const user = await fixture.register("target@example.com");
  await fixture.verifyEmail("target@example.com");
  await user.request("/sign-in/email", { email: "target@example.com", password });
  const current = await verifySession({
    auth: fixture.userAuth,
    database: fixture.database,
    headers: user.headers(),
    audience: "user",
  });
  await setUserRole(fixture.database, authority.session.id, current.user.id, "admin");
  await expect(
    verifySession({
      auth: fixture.userAuth,
      database: fixture.database,
      headers: user.headers(),
      audience: "user",
    }),
  ).rejects.toThrow("SESSION_REQUIRED");
});

test("old weak admin session cannot enroll another factor after MFA enrollment", async ({
  fixture,
}) => {
  await fixture.register("admin@example.com");
  await fixture.verifyEmail("admin@example.com");
  await bootstrapAdmin(fixture.database, "admin@example.com");
  const first = new BrowserClient(fixture.adminAuth, "http://localhost:4102");
  const old = new BrowserClient(fixture.adminAuth, "http://localhost:4102");
  await first.request("/sign-in/email", { email: "admin@example.com", password });
  await old.request("/sign-in/email", { email: "admin@example.com", password });
  await enableTotp(first);
  const attempt = await old.request("/passkey/generate-register-options");
  expect(attempt.status).toBe(403);
  expect(await attempt.json()).toMatchObject({ message: "EXISTING_FACTOR_REQUIRED" });
  const failedCode = await old.request("/two-factor/verify-totp", { code: "invalid-code" });
  expect(failedCode.ok).toBe(false);
  const verify = {
    auth: fixture.adminAuth,
    database: fixture.database,
    headers: old.headers(),
    audience: "admin" as const,
  };
  expect((await verifySession({ ...verify, allowEnrollment: true })).strong).toBe(false);
  await expect(verifySession(verify)).rejects.toThrow("ADMIN_MFA_REQUIRED");
});

test.for(["user", "admin"] as const)(
  "weak admin session cannot retrieve TOTP secret through %s app",
  async (audience, { fixture }) => {
    const email = "admin@example.com";
    await fixture.register(email);
    await fixture.verifyEmail(email);
    await bootstrapAdmin(fixture.database, email);
    const auth = audience === "admin" ? fixture.adminAuth : fixture.userAuth;
    const origin = audience === "admin" ? "http://localhost:4102" : "http://localhost:4101";
    const old = new BrowserClient(auth, origin);
    expect((await old.request("/sign-in/email", { email, password })).status).toBe(200);
    const enrollment = new BrowserClient(fixture.adminAuth, "http://localhost:4102");
    expect((await enrollment.request("/sign-in/email", { email, password })).status).toBe(200);
    const { authenticator } = await enableTotp(enrollment);

    const denied = await old.request("/two-factor/get-totp-uri", { password });
    expect(denied.status).toBe(403);
    const body: unknown = await denied.json();
    expect(body).toMatchObject({ message: "ADMIN_MFA_REQUIRED" });
    expect(body).not.toHaveProperty("totpURI");
    const verification = {
      auth,
      database: fixture.database,
      headers: old.headers(),
      audience,
      allowEnrollment: true,
    };
    expect((await verifySession(verification)).strong).toBe(false);

    expect(
      (await old.request("/two-factor/verify-totp", { code: authenticator.generate() })).status,
    ).toBe(200);
    expect((await verifySession({ ...verification, headers: old.headers() })).strong).toBe(true);
    const allowed = await old.request("/two-factor/get-totp-uri", { password });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toHaveProperty(
      "totpURI",
      expect.stringMatching(/^otpauth:\/\/totp\//),
    );
  },
);

test.for(["user", "admin"] as const)(
  "admin recovery session cannot retrieve TOTP secret through %s app",
  async (audience, { fixture }) => {
    const email = "admin@example.com";
    await fixture.register(email);
    await fixture.verifyEmail(email);
    await bootstrapAdmin(fixture.database, email);
    const enrollment = new BrowserClient(fixture.adminAuth, "http://localhost:4102");
    expect((await enrollment.request("/sign-in/email", { email, password })).status).toBe(200);
    const { backupCodes } = await enableTotp(enrollment);
    const auth = audience === "admin" ? fixture.adminAuth : fixture.userAuth;
    const origin = audience === "admin" ? "http://localhost:4102" : "http://localhost:4101";
    const recovery = new BrowserClient(auth, origin);
    const login = await recovery.request("/sign-in/email", { email, password });
    expect(await login.json()).toMatchObject({ twoFactorRedirect: true });
    expect(
      (await recovery.request("/two-factor/verify-backup-code", { code: backupCodes[0] })).status,
    ).toBe(200);
    const current = await verifySession({
      auth,
      database: fixture.database,
      headers: recovery.headers(),
      audience,
      allowEnrollment: true,
    });
    expect(current.session.authenticationMethod).toBe("recovery");
    expect(current.strong).toBe(false);
    const denied = await recovery.request("/two-factor/get-totp-uri", { password });
    expect(denied.status).toBe(403);
    const body: unknown = await denied.json();
    expect(body).toMatchObject({ message: "ADMIN_MFA_REQUIRED" });
    expect(body).not.toHaveProperty("totpURI");
  },
);

test("regular user can still retrieve TOTP URI with their password", async ({ fixture }) => {
  const email = "reader@example.com";
  const enrollment = await fixture.register(email);
  await fixture.verifyEmail(email);
  expect((await enrollment.request("/sign-in/email", { email, password })).status).toBe(200);
  const old = new BrowserClient(fixture.userAuth, "http://localhost:4101");
  expect((await old.request("/sign-in/email", { email, password })).status).toBe(200);
  await enableTotp(enrollment);
  const current = await verifySession({
    auth: fixture.userAuth,
    database: fixture.database,
    headers: old.headers(),
    audience: "user",
  });
  expect(current.user.role).toBe("user");
  expect(current.strong).toBe(false);
  const response = await old.request("/two-factor/get-totp-uri", { password });
  expect(response.status).toBe(200);
  expect(await response.json()).toHaveProperty(
    "totpURI",
    expect.stringMatching(/^otpauth:\/\/totp\//),
  );
});

test.for(["userAuth", "wikiAuth"] as const)(
  "database exposes every field required by the %s plugins",
  (name, { fixture }) => {
    const expected = getSchema(fixture[name].options);
    const actual = getSchemaShape();
    for (const [model, description] of Object.entries(expected)) {
      expect(actual[model]).toEqual(expect.arrayContaining(Object.keys(description.fields)));
    }
    expect(expected["passkey"]?.fields["audience"]?.input).toBe(false);
    expect(expected["verification"]?.fields["audience"]?.input).toBe(false);
  },
);

const wikiOrigin = "http://localhost:4103";
const redirectUri = "http://127.0.0.1:43123/callback";
const redirectSchema = v.object({ url: v.string() });

function base64url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

async function wikiAdministrator(fixture: Fixture, email = "owner@example.com") {
  await fixture.register(email);
  await fixture.verifyEmail(email);
  await bootstrapAdmin(fixture.database, email);
  const admin = new BrowserClient(fixture.adminAuth, "http://localhost:4102");
  await admin.request("/sign-in/email", { email, password });
  const { authenticator } = await enableTotp(admin);
  const wiki = new BrowserClient(fixture.wikiAuth, wikiOrigin);
  const signIn = await wiki.request("/sign-in/email", { email, password });
  expect(await signIn.json()).toMatchObject({ twoFactorRedirect: true });
  expect(
    (await wiki.request("/two-factor/verify-totp", { code: authenticator.generate() })).status,
  ).toBe(200);
  return wiki;
}

async function startAuthorization(fixture: Fixture) {
  const anonymous = new BrowserClient(fixture.wikiAuth, wikiOrigin);
  const registration = await anonymous.request("/oauth2/register", {
    client_name: "Test MCP client",
    redirect_uris: [redirectUri],
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  });
  expect(registration.status).toBe(201);
  const { client_id: clientId } = v.parse(
    v.object({ client_id: v.string() }),
    await registration.json(),
  );
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );
  const authorize = new URL(`${wikiOrigin}/api/auth/oauth2/authorize`);
  for (const [key, value] of Object.entries({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "wiki:read offline_access",
    state: "state-value",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: `${wikiOrigin}/mcp`,
  }))
    authorize.searchParams.set(key, value);
  const redirect = await anonymous.navigate(authorize.href);
  expect(redirect.status).toBe(302);
  const login = new URL(redirect.headers.get("location") ?? "", wikiOrigin);
  expect(login.pathname).toBe("/login");
  return { clientId, verifier, oauthQuery: login.search.slice(1) };
}

async function grantAuthorization(wiki: BrowserClient, oauthQuery: string) {
  const continued = await wiki.request("/oauth2/continue", {
    postLogin: true,
    oauth_query: oauthQuery,
  });
  expect(continued.status).toBe(200);
  const next = new URL(v.parse(redirectSchema, await continued.json()).url, wikiOrigin);
  expect(next.pathname).toBe("/consent");
  const consented = await wiki.request("/oauth2/consent", {
    accept: true,
    oauth_query: next.search.slice(1),
  });
  expect(consented.status).toBe(200);
  const callback = new URL(v.parse(redirectSchema, await consented.json()).url);
  expect(`${callback.origin}${callback.pathname}`).toBe(redirectUri);
  expect(callback.searchParams.get("state")).toBe("state-value");
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("AUTHORIZATION_CODE_MISSING");
  return code;
}

async function exchangeCode(
  fixture: Fixture,
  flow: { clientId: string; verifier: string },
  code: string,
) {
  const response = await fixture.wikiAuth.handler(
    new Request(`${wikiOrigin}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: flow.verifier,
        client_id: flow.clientId,
        redirect_uri: redirectUri,
        resource: `${wikiOrigin}/mcp`,
      }),
    }),
  );
  expect(response.status).toBe(200);
  return v.parse(v.object({ access_token: v.string() }), await response.json());
}

function mcpRequest(fixture: Fixture, token?: string) {
  return authorizeMcpRequest({
    auth: fixture.wikiAuth,
    database: fixture.database,
    origin: wikiOrigin,
    request: new Request(`${wikiOrigin}/mcp`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
  });
}

test("wiki publishes OAuth discovery for its MCP resource", async ({ fixture }) => {
  const resource = await fixture.wikiAuth.handler(
    new Request(`${wikiOrigin}/.well-known/oauth-protected-resource/mcp`),
  );
  expect(resource.status).toBe(200);
  expect(await resource.json()).toMatchObject({
    resource: `${wikiOrigin}/mcp`,
    authorization_servers: [`${wikiOrigin}/api/auth`],
  });
  const server = await fixture.wikiAuth.handler(
    new Request(`${wikiOrigin}/.well-known/oauth-authorization-server/api/auth`),
  );
  expect(server.status).toBe(200);
  expect(await server.json()).toMatchObject({
    issuer: `${wikiOrigin}/api/auth`,
    registration_endpoint: `${wikiOrigin}/api/auth/oauth2/register`,
    code_challenge_methods_supported: ["S256"],
  });
  const challenge = await mcpRequest(fixture);
  if (!(challenge instanceof Response)) throw new Error("CHALLENGE_EXPECTED");
  expect(challenge.status).toBe(401);
  expect(challenge.headers.get("www-authenticate")).toContain(
    `resource_metadata="${wikiOrigin}/.well-known/oauth-protected-resource/mcp"`,
  );
});

test("strong wiki administrator authorizes an MCP client that can then read the wiki", async ({
  fixture,
}) => {
  const flow = await startAuthorization(fixture);
  const wiki = await wikiAdministrator(fixture);
  const code = await grantAuthorization(wiki, flow.oauthQuery);
  const tokens = await exchangeCode(fixture, flow, code);
  const granted = await mcpRequest(fixture, tokens.access_token);
  if (granted instanceof Response) throw new Error(`MCP_ACCESS_DENIED_${granted.status}`);
  expect(granted.userId).toMatch(/^.+$/);
  const tampered = await mcpRequest(fixture, `${tokens.access_token.slice(0, -2)}xx`);
  if (!(tampered instanceof Response)) throw new Error("CHALLENGE_EXPECTED");
  expect(tampered.status).toBe(401);
});

test("demoted administrator loses MCP access even with an unexpired token", async ({ fixture }) => {
  const flow = await startAuthorization(fixture);
  const wiki = await wikiAdministrator(fixture);
  const tokens = await exchangeCode(fixture, flow, await grantAuthorization(wiki, flow.oauthQuery));
  const owner = await verifySession({
    auth: fixture.wikiAuth,
    database: fixture.database,
    headers: wiki.headers(),
    audience: "wiki",
  });
  await fixture.register("second@example.com");
  await fixture.verifyEmail("second@example.com");
  await fixture.binding
    .prepare("UPDATE user SET role = 'admin' WHERE email = ?")
    .bind("second@example.com")
    .run();
  await fixture.binding
    .prepare("UPDATE user SET role = 'user' WHERE id = ?")
    .bind(owner.user.id)
    .run();
  await expect(
    verifySession({
      auth: fixture.wikiAuth,
      database: fixture.database,
      headers: wiki.headers(),
      audience: "wiki",
    }),
  ).rejects.toThrow("SESSION_REQUIRED");
  const denied = await mcpRequest(fixture, tokens.access_token);
  if (!(denied instanceof Response)) throw new Error("DENIAL_EXPECTED");
  expect(denied.status).toBe(403);
});

test("weak or non-administrator wiki sessions cannot grant MCP access", async ({ fixture }) => {
  const flow = await startAuthorization(fixture);
  await fixture.register("owner@example.com");
  await fixture.verifyEmail("owner@example.com");
  await bootstrapAdmin(fixture.database, "owner@example.com");
  const weak = new BrowserClient(fixture.wikiAuth, wikiOrigin);
  expect(
    (await weak.request("/sign-in/email", { email: "owner@example.com", password })).status,
  ).toBe(200);
  const continued = await weak.request("/oauth2/continue", {
    postLogin: true,
    oauth_query: flow.oauthQuery,
  });
  expect(continued.status).toBe(403);
  expect(await continued.json()).toMatchObject({ message: "ADMIN_MFA_REQUIRED" });

  const smuggled = new BrowserClient(fixture.wikiAuth, wikiOrigin);
  const signIn = await smuggled.request("/sign-in/email", {
    email: "owner@example.com",
    password,
    oauth_query: flow.oauthQuery,
  });
  expect(signIn.status).toBe(403);
  expect(await signIn.json()).toMatchObject({ message: "OAUTH_QUERY_NOT_ACCEPTED" });

  await fixture.register("member@example.com");
  await fixture.verifyEmail("member@example.com");
  const member = new BrowserClient(fixture.wikiAuth, wikiOrigin);
  const memberSignIn = await member.request("/sign-in/email", {
    email: "member@example.com",
    password,
  });
  expect(memberSignIn.ok).toBe(false);
  expect(
    (
      await member.request("/sign-up/email", {
        name: "new",
        email: "new@example.com",
        password,
      })
    ).ok,
  ).toBe(false);
});
