import { http, HttpResponse } from "msw";
import type { HttpResponseResolver } from "msw";
import { setupServer } from "msw/node";
import { expect, test } from "vite-plus/test";
import { probeService } from "./probe.ts";
import type { HealthTarget, ProbeResult } from "./probe.ts";

const userTarget: HealthTarget = {
  service: "user",
  origin: "https://app.example.com",
  guard: null,
};
const adminTarget: HealthTarget = {
  service: "admin",
  origin: "https://admin.example.com",
  guard: "https://team.cloudflareaccess.com",
};

async function probe(target: HealthTarget, resolver: HttpResponseResolver): Promise<ProbeResult> {
  const server = setupServer(http.get(`${target.origin}/api/health`, resolver));
  server.listen({ onUnhandledRequest: "error" });
  try {
    return await probeService(target);
  } finally {
    server.close();
  }
}

test("an application reporting its own service name and release is healthy", async () => {
  expect(
    await probe(userTarget, () =>
      HttpResponse.json({ ok: true, service: "user", release: "0123456789abcdef" }),
    ),
  ).toEqual({ service: "user", healthy: true, detail: "release_0123456789abcdef" });
});

test.each([
  {
    name: "answering for another application",
    resolver: () => HttpResponse.json({ ok: true, service: "admin", release: "0123456789abcdef" }),
    detail: "payload_invalid",
  },
  {
    name: "reporting a failed dependency",
    resolver: () => HttpResponse.json({ error: "処理に失敗しました。" }, { status: 500 }),
    detail: "status_500",
  },
  {
    name: "returning something other than JSON",
    resolver: () => HttpResponse.text("<!doctype html>"),
    detail: "body_unreadable",
  },
  { name: "unreachable", resolver: () => HttpResponse.error(), detail: "unreachable" },
])("an application $name is unhealthy", async ({ resolver, detail }) => {
  expect(await probe(userTarget, resolver)).toEqual({
    service: "user",
    healthy: false,
    detail,
  });
});

test("a guarded application is healthy while Cloudflare Access redirects anonymous probes", async () => {
  expect(
    await probe(
      adminTarget,
      () =>
        new HttpResponse(null, {
          status: 302,
          headers: { location: "https://team.cloudflareaccess.com/cdn-cgi/access/login/admin" },
        }),
    ),
  ).toEqual({ service: "admin", healthy: true, detail: "access_guarded" });
});

test.each([
  {
    name: "answering anonymous requests itself",
    resolver: () => HttpResponse.json({ ok: true, service: "admin", release: "0123456789abcdef" }),
    detail: "unguarded_200",
  },
  {
    name: "redirecting somewhere other than the Access issuer",
    resolver: () =>
      new HttpResponse(null, { status: 302, headers: { location: "https://phish.example/" } }),
    detail: "unguarded_302",
  },
])("a guarded application $name is unhealthy", async ({ resolver, detail }) => {
  expect(await probe(adminTarget, resolver)).toEqual({
    service: "admin",
    healthy: false,
    detail,
  });
});
