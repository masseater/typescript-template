import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vite-plus/test";
import type { HealthTarget } from "./config.ts";
import type { ProbeResult } from "./probe.ts";
import { probeService } from "./probe.ts";
import { setupServer } from "msw/node";

type Resolver = () => Response;

const INTERNAL_SERVER_ERROR = 500;
const release = "0123456789abcdef";

const userTarget: HealthTarget = {
  origin: "https://app.example.com",
  service: "user",
};

async function probe(target: HealthTarget, resolver: Resolver): Promise<ProbeResult> {
  const server = setupServer(http.get(`${target.origin}/api/health`, resolver));
  server.listen({ onUnhandledRequest: "error" });
  try {
    return await probeService(target);
  } finally {
    server.close();
  }
}

describe("application probes", () => {
  it("an application reporting its own service name and release is healthy", async () => {
    expect.hasAssertions();
    await expect(
      probe(userTarget, () => HttpResponse.json({ ok: true, release, service: "user" })),
    ).resolves.toStrictEqual({ detail: `release_${release}`, healthy: true, service: "user" });
  });

  it.each([
    {
      detail: "payload_invalid",
      name: "answering for another application",
      resolver: (): Response => HttpResponse.json({ ok: true, release, service: "admin" }),
    },
    {
      detail: "status_500",
      name: "reporting a failed dependency",
      resolver: (): Response =>
        HttpResponse.json({ error: "処理に失敗しました。" }, { status: INTERNAL_SERVER_ERROR }),
    },
    {
      detail: "body_unreadable",
      name: "returning something other than JSON",
      resolver: (): Response => HttpResponse.text("<!doctype html>"),
    },
    { detail: "unreachable", name: "unreachable", resolver: (): Response => HttpResponse.error() },
  ] as const)("an application $name is unhealthy", async ({ resolver, detail }) => {
    expect.hasAssertions();
    await expect(probe(userTarget, resolver)).resolves.toStrictEqual({
      detail,
      healthy: false,
      service: "user",
    });
  });
});
