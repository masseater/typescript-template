import { expect, test } from "vitest";
import { enforceAdminAccess, localAccessCookie } from "./access.ts";

test.for(["/", "/login", "/api/users", "/assets/admin.js", "/assets/admin.js.map"])(
  "protects %s before application delivery",
  async (pathname) => {
    const response = await enforceAdminAccess(new Request(`http://localhost:3002${pathname}`), {
      APP_ORIGIN: "http://localhost:3002",
      LOCAL_ADMIN_USER: "operator",
      LOCAL_ADMIN_PASSWORD: crypto.randomUUID(),
    });
    expect(response?.status).toBe(401);
    expect(await response?.text()).toBe("Authentication required");
  },
);

test("accepts only the configured local entry credentials and origin", async () => {
  const password = crypto.randomUUID();
  const bindings = {
    APP_ORIGIN: "http://localhost:3002",
    LOCAL_ADMIN_USER: "operator",
    LOCAL_ADMIN_PASSWORD: password,
  };
  const headers = { authorization: `Basic ${btoa(`operator:${password}`)}` };
  expect(
    await enforceAdminAccess(new Request("http://localhost:3002/login", { headers }), bindings),
  ).toBeNull();
  expect(
    (await enforceAdminAccess(new Request("http://127.0.0.1:3002/login", { headers }), bindings))
      ?.status,
  ).toBe(401);
  expect(
    (
      await enforceAdminAccess(
        new Request("http://localhost:3002/login", {
          headers: { authorization: `Basic ${btoa("operator:wrong")}` },
        }),
        bindings,
      )
    )?.status,
  ).toBe(401);
});

test("local entry cookie issued after credentials admits requests without credentials", async () => {
  const password = crypto.randomUUID();
  const bindings = {
    APP_ORIGIN: "http://localhost:3002",
    LOCAL_ADMIN_USER: "operator",
    LOCAL_ADMIN_PASSWORD: password,
  };
  const cookie = await localAccessCookie(bindings);
  expect(cookie).toMatch(/^local-admin-gate=[\w-]+; Path=\/; HttpOnly; SameSite=Strict$/);
  expect(cookie).not.toContain(password);
  const value = cookie?.split(";", 1)[0] ?? "";
  expect(
    await enforceAdminAccess(
      new Request("http://localhost:3002/api/telemetry", { headers: { cookie: `a=b; ${value}` } }),
      bindings,
    ),
  ).toBeNull();
  const otherPassword = await localAccessCookie({
    ...bindings,
    LOCAL_ADMIN_PASSWORD: crypto.randomUUID(),
  });
  expect(
    (
      await enforceAdminAccess(
        new Request("http://localhost:3002/api/telemetry", {
          headers: { cookie: otherPassword?.split(";", 1)[0] ?? "" },
        }),
        bindings,
      )
    )?.status,
  ).toBe(401);
  expect(await localAccessCookie({ APP_ORIGIN: "https://admin.example.test" })).toBeNull();
});

test("does not enable the local entry gate for a production domain", async () => {
  await expect(
    enforceAdminAccess(new Request("https://admin.example.test/login"), {
      APP_ORIGIN: "https://admin.example.test",
      LOCAL_ADMIN_USER: "operator",
      LOCAL_ADMIN_PASSWORD: crypto.randomUUID(),
    }),
  ).rejects.toThrow("ACCESS_ISSUER");
});

test("requires a Cloudflare Access assertion in production", async () => {
  const response = await enforceAdminAccess(
    new Request("https://admin.example.test/assets/admin.js"),
    {
      APP_ORIGIN: "https://admin.example.test",
      ACCESS_ISSUER: "https://template.cloudflareaccess.com",
      ACCESS_AUD: "application-audience",
    },
  );
  expect(response?.status).toBe(401);
});
