import { HTTP_FORBIDDEN, HTTP_NOT_FOUND, HTTP_OK, PASSWORD, signIn } from "./browser-client.ts";
import { createTestDatabase, getSchemaShape } from "@template/db/testing";
import { describe, expect, expectTypeOf } from "vite-plus/test";
import { bootstrapAdmin } from "@template/db/admin";
import { createAuthTest } from "./auth-test-fixture.ts";
import { getSchema } from "better-auth/db";

const it = createAuthTest({ bootstrapAdmin, createTestDatabase });

describe("email verification", () => {
  it("requires an actual email verification before password login", async ({ fixture }) => {
    expect.hasAssertions();
    const client = await fixture.register("alice@example.com");
    const unverified = await signIn(client, "alice@example.com");
    await fixture.verifyEmail("alice@example.com");
    const verified = await signIn(client, "alice@example.com");
    expect(unverified.status).toBe(HTTP_FORBIDDEN);
    expect(verified.status).toBe(HTTP_OK);
  });

  it("records a weak verified session without logging personal data", async ({ fixture }) => {
    expect.hasAssertions();
    const client = await fixture.registerVerified("alice@example.com");
    await signIn(client, "alice@example.com");
    const current = await fixture.verify({ audience: "user", headers: client.headers() });
    expectTypeOf(current.user.twoFactorEnabled).toEqualTypeOf<boolean>();
    expect({
      emailVerified: current.user.emailVerified,
      strong: current.strong,
      twoFactorEnabled: current.user.twoFactorEnabled,
    }).toStrictEqual({ emailVerified: true, strong: false, twoFactorEnabled: false });
    expect(fixture.queries.map((query) => query.operation)).toStrictEqual(
      expect.arrayContaining(["SELECT", "INSERT", "UPDATE"]),
    );
    expect(fixture.queries.every((query) => query.duration >= 0)).toBe(true);
    expect(JSON.stringify(fixture.queries)).not.toContain("alice@example.com");
  });
});

describe("registration inputs", () => {
  it("HTTP inputs cannot self-assign role, audience or authentication strength", async ({
    fixture,
  }) => {
    expect.hasAssertions();
    const client = await fixture.registerVerified("reader@example.com");
    await signIn(client, "reader@example.com");
    await client.request("/update-user", { role: "admin", securityVersion: 99 });
    await client.request("/update-session", {
      audience: "admin",
      authenticationMethod: "passkey_uv",
    });
    const current = await fixture.verify({ audience: "user", headers: client.headers() });
    expect(current.user.role).toBe("user");
    expect(current.session.audience).toBe("user");
    expect(current.strong).toBe(false);
  });

  it("admin cannot publicly register and user auth has no admin endpoints", async ({ fixture }) => {
    expect.hasAssertions();
    const signUp = await fixture
      .client("admin")
      .request("/sign-up/email", { email: "admin@example.com", name: "admin", password: PASSWORD });
    const user = fixture.client("user");
    const listUsers = await user.request("/admin/list-users");
    const setRole = await user.request("/admin/set-role", { role: "admin", userId: "x" });
    expect(signUp.ok).toBe(false);
    expect(listUsers.status).toBe(HTTP_NOT_FOUND);
    expect(setRole.status).toBe(HTTP_NOT_FOUND);
  });
});

describe("database schema", () => {
  it("exposes every field required by the configured Better Auth plugins", ({ fixture }) => {
    expect.hasAssertions();
    const expected = getSchema(fixture.userAuth.options);
    const actual = getSchemaShape();
    for (const [model, description] of Object.entries(expected)) {
      expect(actual[model]).toStrictEqual(expect.arrayContaining(Object.keys(description.fields)));
    }
    expect(expected["passkey"]?.fields["audience"]?.input).toBe(false);
    expect(expected["verification"]?.fields["audience"]?.input).toBe(false);
  });
});
