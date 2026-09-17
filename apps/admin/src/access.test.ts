import { describe, expect, it } from "vitest";
import { enforceAdminAccess, localAccessCookie } from "./access.ts";

const unauthorizedStatus = 401;
const localOrigin = "http://localhost:3002";
const productionOrigin = "https://admin.example.test";

function localBindings(password: string): Record<string, string> {
  return { APP_ORIGIN: localOrigin, LOCAL_ADMIN_PASSWORD: password, LOCAL_ADMIN_USER: "operator" };
}

function basicAuthorization(credentials: string): { authorization: string } {
  return { authorization: `Basic ${btoa(credentials)}` };
}

function cookieRequest(setCookie: string | undefined): Request {
  const pair = setCookie?.split(";", 1)[0] ?? "";
  return new Request(`${localOrigin}/api/telemetry`, { headers: { cookie: `a=b; ${pair}` } });
}

function missingSetting(key: string): unknown {
  return expect.objectContaining({ path: [expect.objectContaining({ key })] });
}

describe("local administrator entry gate", () => {
  it.for(["/", "/login", "/api/users", "/assets/admin.js", "/assets/admin.js.map"])(
    "protects %s before application delivery",
    async (pathname) => {
      expect.hasAssertions();
      const response = await enforceAdminAccess(
        new Request(`${localOrigin}${pathname}`),
        localBindings(crypto.randomUUID()),
      );
      expect(response?.status).toBe(unauthorizedStatus);
      await expect(response?.text()).resolves.toBe("Authentication required");
    },
  );

  it("accepts only the configured local entry credentials and origin", async () => {
    expect.hasAssertions();
    const password = crypto.randomUUID();
    const headers = basicAuthorization(`operator:${password}`);
    await expect(
      enforceAdminAccess(new Request(`${localOrigin}/login`, { headers }), localBindings(password)),
    ).resolves.toBeUndefined();
    const otherOrigin = await enforceAdminAccess(
      new Request("http://127.0.0.1:3002/login", { headers }),
      localBindings(password),
    );
    expect(otherOrigin?.status).toBe(unauthorizedStatus);
    const wrongPassword = await enforceAdminAccess(
      new Request(`${localOrigin}/login`, { headers: basicAuthorization("operator:wrong") }),
      localBindings(password),
    );
    expect(wrongPassword?.status).toBe(unauthorizedStatus);
  });
});

describe("local administrator entry cookie", () => {
  it("admits requests without credentials after credentials are accepted", async () => {
    expect.hasAssertions();
    const password = crypto.randomUUID();
    const cookie = await localAccessCookie(localBindings(password));
    expect(cookie).toMatch(/^local-admin-gate=[\w-]+; Path=\/; HttpOnly; SameSite=Strict$/u);
    expect(cookie).not.toContain(password);
    await expect(
      enforceAdminAccess(cookieRequest(cookie), localBindings(password)),
    ).resolves.toBeUndefined();
  });

  it("rejects a cookie issued for another password", async () => {
    expect.hasAssertions();
    const cookie = await localAccessCookie(localBindings(crypto.randomUUID()));
    const response = await enforceAdminAccess(
      cookieRequest(cookie),
      localBindings(crypto.randomUUID()),
    );
    expect(response?.status).toBe(unauthorizedStatus);
  });
});

describe("production administrator access", () => {
  it("does not issue the local entry cookie", async () => {
    expect.hasAssertions();
    await expect(localAccessCookie({ APP_ORIGIN: productionOrigin })).resolves.toBeUndefined();
  });

  it("does not enable the local entry gate", async () => {
    expect.hasAssertions();
    const bindings = { ...localBindings(crypto.randomUUID()), APP_ORIGIN: productionOrigin };
    await expect(
      enforceAdminAccess(new Request(`${productionOrigin}/login`), bindings),
    ).rejects.toMatchObject({
      issues: [missingSetting("ACCESS_AUD"), missingSetting("ACCESS_ISSUER")],
    });
  });

  it("requires a Cloudflare Access assertion", async () => {
    expect.hasAssertions();
    const response = await enforceAdminAccess(new Request(`${productionOrigin}/assets/admin.js`), {
      ACCESS_AUD: "application-audience",
      ACCESS_ISSUER: "https://template.cloudflareaccess.com",
      APP_ORIGIN: productionOrigin,
    });
    expect(response?.status).toBe(unauthorizedStatus);
  });
});
