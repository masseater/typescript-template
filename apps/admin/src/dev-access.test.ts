import { test as baseTest, describe, expect } from "vite-plus/test";
import type { DevServer } from "#dev-access-fixture";
import type { HttpCall } from "#dev-access-client";
import { fetchPath } from "#dev-access-client";
import { withDevServer } from "#dev-access-fixture";

const okStatus = 200;
const unauthorizedStatus = 401;
const forbiddenStatus = 403;

const test = baseTest.extend<{ dev: DevServer }>({
  dev: [
    async ({}, provide): Promise<void> => {
      await withDevServer(provide);
    },
    { scope: "file" },
  ],
});

describe("admin development entry authentication", () => {
  test.for([
    "/",
    "/login",
    "/@vite/client",
    "/@react-refresh",
    "/src/admin.js",
    "/node_modules/.vite/deps/react.js",
    "/@id/virtual:test",
    "/@fs/{root}/src/admin.js",
    "/src/admin.js?raw",
    "/.dev.vars",
    "/.local/runtime.json",
    "/api/users",
  ])("is required before delivering %s", async (pathname, { dev }) => {
    expect.hasAssertions();
    const response = await fetchPath(dev, {
      authorized: false,
      pathname: pathname.replace("{root}", dev.root),
    });
    expect(response.status).toBe(unauthorizedStatus);
    expect(response.body).toBe("Authentication required");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  test("admits Vite resources", async ({ dev }) => {
    expect.hasAssertions();
    const page = await fetchPath(dev, { authorized: true, pathname: "/" });
    expect(page.status).toBe(okStatus);
    const module = await fetchPath(dev, { authorized: true, pathname: "/src/admin.js" });
    expect(module.body).toContain("administrator-module");
    const client = await fetchPath(dev, { authorized: true, pathname: "/@vite/client" });
    expect(client.status).toBe(okStatus);
  });

  test("is required to revalidate cached modules", async ({ dev }) => {
    expect.hasAssertions();
    const cached = await fetchPath(dev, { authorized: true, pathname: "/src/admin.js" });
    const revalidated = await fetchPath(dev, {
      authorized: false,
      headers: { "if-none-match": String(cached.headers.etag) },
      pathname: "/src/admin.js",
    });
    expect(revalidated.status).toBe(unauthorizedStatus);
  });
});

describe("admin development untrusted requests", () => {
  test.for<HttpCall & { readonly status: number }>([
    { authorized: false, pathname: "/@vite/client", status: unauthorizedStatus },
    {
      authorized: true,
      headers: { authorization: "Basic invalid!" },
      pathname: "/@vite/client",
      status: unauthorizedStatus,
    },
    {
      authorized: true,
      headers: { authorization: `Basic ${btoa("operator:incorrect")}` },
      pathname: "/@vite/client",
      status: unauthorizedStatus,
    },
    {
      authorized: true,
      headers: { origin: "https://attacker.invalid" },
      pathname: "/src/admin.js",
      status: unauthorizedStatus,
    },
    {
      authorized: true,
      headers: { host: "attacker.invalid" },
      pathname: "/src/admin.js",
      status: forbiddenStatus,
    },
  ])("rejects $pathname with $headers", async (call, { dev }) => {
    expect.hasAssertions();
    const response = await fetchPath(dev, call);
    expect(response.status).toBe(call.status);
  });
});

describe("admin development credential files", () => {
  test.for([
    "/.dev.vars",
    "/.dev.vars?raw",
    "/.dev.vars?url",
    "/.local/runtime.json",
    "/@fs/{root}/.dev.vars",
    "/@fs/{root}/.local/runtime.json",
  ])("does not serve %s after entry authentication", async (pathname, { dev }) => {
    expect.hasAssertions();
    const response = await fetchPath(dev, {
      authorized: true,
      pathname: pathname.replace("{root}", dev.root),
    });
    expect(response.status).toBe(forbiddenStatus);
  });
});
