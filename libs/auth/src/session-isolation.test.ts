import type { BrowserClient, TotpEnrollment } from "./browser-client.ts";
import { HTTP_FORBIDDEN, HTTP_OK, enableTotp, signIn } from "./browser-client.ts";
import { bootstrapAdmin, setUserRole } from "@template/db/admin";
import { describe, expect } from "vitest";
import type { AuthFixture } from "./auth-test-fixture.ts";
import { createAuthTest } from "./auth-test-fixture.ts";
import { createTestDatabase } from "@template/db/testing";

const it = createAuthTest({ bootstrapAdmin, createTestDatabase });

async function pendingTotpChallenge(
  client: BrowserClient,
  email: string,
): Promise<TotpEnrollment["authenticator"]> {
  await signIn(client, email);
  const { authenticator } = await enableTotp(client);
  await client.request("/sign-out", {});
  const pending = await signIn(client, email);
  await expect(pending.json()).resolves.toMatchObject({ twoFactorRedirect: true });
  return authenticator;
}

async function strongAdminSession(
  fixture: AuthFixture,
  email: string,
): ReturnType<AuthFixture["verify"]> {
  await fixture.registerAdmin(email);
  const admin = fixture.client("admin");
  await signIn(admin, email);
  await enableTotp(admin);
  return fixture.verify({ audience: "admin", headers: admin.headers() });
}

function adminCookieHeaders(client: BrowserClient): Headers {
  const cookie = client.headers().get("cookie") ?? "";
  return new Headers({ cookie: cookie.replaceAll("template-user", "template-admin") });
}

function copyCookiesToAdmin(from: BrowserClient, to: BrowserClient): void {
  for (const [key, value] of from.cookies) {
    to.cookies.set(key.replace("template-user", "template-admin"), value);
  }
}

describe("second factor session", () => {
  it("TOTP sign-in has no usable session until valid second factor", async ({ fixture }) => {
    expect.hasAssertions();
    const client = await fixture.registerVerified("totp@example.com");
    const authenticator = await pendingTotpChallenge(client, "totp@example.com");
    await expect(fixture.verify({ audience: "user", headers: client.headers() })).rejects.toThrow(
      "SESSION_REQUIRED",
    );
    const invalid = await client.request("/two-factor/verify-totp", { code: "invalid-code" });
    const valid = await client.request("/two-factor/verify-totp", {
      code: authenticator.generate(),
    });
    const current = await fixture.verify({ audience: "user", headers: client.headers() });
    expect(invalid.ok).toBe(false);
    expect(valid.status).toBe(HTTP_OK);
    expect(current.strong).toBe(true);
  });
});

describe("cross-app isolation", () => {
  it("shared signing secret cannot turn a user session into admin session", async ({ fixture }) => {
    expect.hasAssertions();
    const client = await fixture.registerAdmin("admin@example.com");
    await signIn(client, "admin@example.com");
    await expect(
      fixture.verify({
        allowEnrollment: true,
        audience: "admin",
        headers: adminCookieHeaders(client),
      }),
    ).rejects.toThrow("SESSION_INVALID");
  });

  it("shared signing secret cannot transfer a pending TOTP challenge across apps", async ({
    fixture,
  }) => {
    expect.hasAssertions();
    const client = await fixture.registerAdmin("admin@example.com");
    const authenticator = await pendingTotpChallenge(client, "admin@example.com");
    const admin = fixture.client("admin");
    copyCookiesToAdmin(client, admin);
    const response = await admin.request("/two-factor/verify-totp", {
      code: authenticator.generate(),
    });
    expect(response.status).toBe(HTTP_FORBIDDEN);
    await expect(response.json()).resolves.toMatchObject({ message: "CHALLENGE_AUDIENCE_INVALID" });
  });
});

describe("session revocation", () => {
  it("revocation invalidates an actual HTTP session", async ({ fixture }) => {
    expect.hasAssertions();
    const authority = await strongAdminSession(fixture, "owner@example.com");
    const user = await fixture.registerVerified("target@example.com");
    await signIn(user, "target@example.com");
    const current = await fixture.verify({ audience: "user", headers: user.headers() });
    await setUserRole({
      database: fixture.database,
      role: "admin",
      sessionId: authority.session.id,
      targetId: current.user.id,
    });
    await expect(fixture.verify({ audience: "user", headers: user.headers() })).rejects.toThrow(
      "SESSION_REQUIRED",
    );
  });
});
