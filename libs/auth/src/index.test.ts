import { sendVerificationEmail } from "@template/config";
import { createDb } from "@template/db";
import { bootstrapAdmin, setUserRole } from "@template/db/admin";
import { createTestDatabase, getSchemaShape } from "@template/db/testing";
import { getSchema } from "better-auth/db";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { URI } from "otpauth";
import { expect, expectTypeOf, test as baseTest } from "vitest";
import { createAuth, verifySession } from "./index.ts";
import type { Auth } from "./index.ts";

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
    const response = await this.auth.handler(
      new Request(`${this.origin}/api/auth${endpoint}`, {
        method: body ? "POST" : "GET",
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
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
  const register = async (email: string) => {
    const client = new BrowserClient(userAuth, "http://localhost:4101");
    const response = await client.request("/sign-up/email", { name: email, email, password });
    if (!response.ok) throw new Error(`Registration failed: ${response.status}`);
    return client;
  };
  const verifyEmail = async (email: string) => {
    const url = mailbox.get(email);
    if (!url) throw new Error("MAIL_DELIVERY_INVALID");
    expect(new URL(url).searchParams.get("callbackURL")).toBe("/login");
    const response = await userAuth.handler(new Request(url));
    if (!response.ok && response.status !== 302)
      throw new Error(`Verification failed: ${response.status}`);
  };
  return {
    database,
    userAuth,
    adminAuth,
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

test("database exposes every field required by the configured Better Auth plugins", ({
  fixture,
}) => {
  const expected = getSchema(fixture.userAuth.options);
  const actual = getSchemaShape();
  for (const [model, description] of Object.entries(expected)) {
    expect(actual[model]).toEqual(expect.arrayContaining(Object.keys(description.fields)));
  }
  expect(expected["passkey"]?.fields["audience"]?.input).toBe(false);
  expect(expected["verification"]?.fields["audience"]?.input).toBe(false);
});
