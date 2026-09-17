import type { BrowserClient, TotpEnrollment } from "./browser-client.ts";
import {
  HTTP_FORBIDDEN,
  HTTP_OK,
  PASSWORD,
  enableTotp,
  expectSignedIn,
  signIn,
} from "./browser-client.ts";
import { describe, expect } from "vite-plus/test";
import type { Audience } from "@template/db";
import type { AuthFixture } from "./auth-test-fixture.ts";
import { bootstrapAdmin } from "@template/db/admin";
import { createAuthTest } from "./auth-test-fixture.ts";
import { createTestDatabase } from "@template/db/testing";

const it = createAuthTest({ bootstrapAdmin, createTestDatabase });
const ADMIN_EMAIL = "admin@example.com";
const AUDIENCES = ["user", "admin"] as const;
const TOTP_URI_PATTERN = /^otpauth:\/\/totp\//u;

interface WeakAdminSession {
  readonly authenticator: TotpEnrollment["authenticator"];
  readonly old: BrowserClient;
}

async function signedInAdmin(fixture: AuthFixture): Promise<BrowserClient> {
  await fixture.registerAdmin(ADMIN_EMAIL);
  const admin = fixture.client("admin");
  await expectSignedIn(admin, ADMIN_EMAIL);
  return admin;
}

async function userWithStaleSession(fixture: AuthFixture, email: string): Promise<BrowserClient> {
  const enrollment = await fixture.registerVerified(email);
  await expectSignedIn(enrollment, email);
  const old = fixture.client("user");
  await expectSignedIn(old, email);
  await enableTotp(enrollment);
  return old;
}

async function adminWithStaleSession(fixture: AuthFixture): Promise<BrowserClient> {
  await fixture.registerAdmin(ADMIN_EMAIL);
  const first = fixture.client("admin");
  const old = fixture.client("admin");
  await signIn(first, ADMIN_EMAIL);
  await signIn(old, ADMIN_EMAIL);
  await enableTotp(first);
  return old;
}

async function adminWithWeakSession(
  fixture: AuthFixture,
  audience: Audience,
): Promise<WeakAdminSession> {
  await fixture.registerAdmin(ADMIN_EMAIL);
  const old = fixture.client(audience);
  await expectSignedIn(old, ADMIN_EMAIL);
  const enrollment = fixture.client("admin");
  await expectSignedIn(enrollment, ADMIN_EMAIL);
  const { authenticator } = await enableTotp(enrollment);
  return { authenticator, old };
}

async function adminRecoverySession(
  fixture: AuthFixture,
  audience: Audience,
): Promise<BrowserClient> {
  await fixture.registerAdmin(ADMIN_EMAIL);
  const enrollment = fixture.client("admin");
  await expectSignedIn(enrollment, ADMIN_EMAIL);
  const { backupCodes } = await enableTotp(enrollment);
  const recovery = fixture.client(audience);
  const login = await signIn(recovery, ADMIN_EMAIL);
  await expect(login.json()).resolves.toMatchObject({ twoFactorRedirect: true });
  const recovered = await recovery.request("/two-factor/verify-backup-code", {
    code: backupCodes[0],
  });
  expect(recovered.status).toBe(HTTP_OK);
  return recovery;
}

describe("admin enrollment", () => {
  it("admin enrollment session cannot access CRM until real TOTP verification", async ({
    fixture,
  }) => {
    expect.hasAssertions();
    const admin = await signedInAdmin(fixture);
    const verify = { audience: "admin" as const, headers: admin.headers() };
    await expect(fixture.verify(verify)).rejects.toThrow("ADMIN_MFA_REQUIRED");
    const enrolling = await fixture.verify({ ...verify, allowEnrollment: true });
    await enableTotp(admin);
    const enrolled = await fixture.verify({ ...verify, headers: admin.headers() });
    expect(enrolling.strong).toBe(false);
    expect(enrolled.strong).toBe(true);
  });

  it("old weak admin session cannot enroll another factor after MFA enrollment", async ({
    fixture,
  }) => {
    expect.hasAssertions();
    const old = await adminWithStaleSession(fixture);
    const attempt = await old.request("/passkey/generate-register-options");
    expect(attempt.status).toBe(HTTP_FORBIDDEN);
    await expect(attempt.json()).resolves.toMatchObject({ message: "EXISTING_FACTOR_REQUIRED" });
    const failedCode = await old.request("/two-factor/verify-totp", { code: "invalid-code" });
    const enrolling = await fixture.verify({
      allowEnrollment: true,
      audience: "admin",
      headers: old.headers(),
    });
    expect(failedCode.ok).toBe(false);
    expect(enrolling.strong).toBe(false);
    await expect(fixture.verify({ audience: "admin", headers: old.headers() })).rejects.toThrow(
      "ADMIN_MFA_REQUIRED",
    );
  });
});

describe("totp secret for weak admin sessions", () => {
  it.for(AUDIENCES)(
    "weak admin session cannot retrieve TOTP secret through %s app",
    async (audience, { fixture }) => {
      expect.hasAssertions();
      const { old } = await adminWithWeakSession(fixture, audience);
      const denied = await old.request("/two-factor/get-totp-uri", { password: PASSWORD });
      const body: unknown = await denied.json();
      const weak = await fixture.verify({
        allowEnrollment: true,
        audience,
        headers: old.headers(),
      });
      expect(denied.status).toBe(HTTP_FORBIDDEN);
      expect(body).toMatchObject({ message: "ADMIN_MFA_REQUIRED" });
      expect(body).not.toHaveProperty("totpURI");
      expect(weak.strong).toBe(false);
    },
  );
});

describe("totp secret after second factor", () => {
  it.for(AUDIENCES)(
    "weak admin session retrieves TOTP secret after a valid second factor through %s app",
    async (audience, { fixture }) => {
      expect.hasAssertions();
      const { authenticator, old } = await adminWithWeakSession(fixture, audience);
      const verified = await old.request("/two-factor/verify-totp", {
        code: authenticator.generate(),
      });
      const current = await fixture.verify({
        allowEnrollment: true,
        audience,
        headers: old.headers(),
      });
      const allowed = await old.request("/two-factor/get-totp-uri", { password: PASSWORD });
      expect(verified.status).toBe(HTTP_OK);
      expect(current.strong).toBe(true);
      expect(allowed.status).toBe(HTTP_OK);
      await expect(allowed.json()).resolves.toHaveProperty(
        "totpURI",
        expect.stringMatching(TOTP_URI_PATTERN),
      );
    },
  );
});

describe("totp secret for recovery sessions", () => {
  it.for(AUDIENCES)(
    "admin recovery session cannot retrieve TOTP secret through %s app",
    async (audience, { fixture }) => {
      expect.hasAssertions();
      const recovery = await adminRecoverySession(fixture, audience);
      const current = await fixture.verify({
        allowEnrollment: true,
        audience,
        headers: recovery.headers(),
      });
      expect(current.session.authenticationMethod).toBe("recovery");
      expect(current.strong).toBe(false);
      const denied = await recovery.request("/two-factor/get-totp-uri", { password: PASSWORD });
      const body: unknown = await denied.json();
      expect(denied.status).toBe(HTTP_FORBIDDEN);
      expect(body).toMatchObject({ message: "ADMIN_MFA_REQUIRED" });
      expect(body).not.toHaveProperty("totpURI");
    },
  );
});

describe("totp secret for regular users", () => {
  it("regular user can still retrieve TOTP URI with their password", async ({ fixture }) => {
    expect.hasAssertions();
    const old = await userWithStaleSession(fixture, "reader@example.com");
    const current = await fixture.verify({ audience: "user", headers: old.headers() });
    const response = await old.request("/two-factor/get-totp-uri", { password: PASSWORD });
    expect(current.user.role).toBe("user");
    expect(current.strong).toBe(false);
    expect(response.status).toBe(HTTP_OK);
    await expect(response.json()).resolves.toHaveProperty(
      "totpURI",
      expect.stringMatching(TOTP_URI_PATTERN),
    );
  });
});
