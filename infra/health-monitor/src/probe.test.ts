import { Effect } from "effect";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, test } from "vite-plus/test";

import { probeService } from "./probe.ts";

const release = "0".repeat(16);
const healthEndpoint = "https://app.example.com/api/health";
const healthTarget = {
  healthEndpoint,
  origin: "https://app.example.com",
  service: "service-member",
} as const;

describe("a healthy application", () => {
  const it = test.extend("healthProbe", async ({}, { onCleanup }) => {
    const healthApi = setupServer(
      http.get(healthEndpoint, () =>
        HttpResponse.json({ ok: true, release, service: "service-member" }),
      ),
    );
    healthApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      healthApi.close();
    });
    return Effect.runPromise(probeService(healthTarget));
  });

  it("reports its own service name and release", ({ healthProbe }) => {
    expect(healthProbe).toStrictEqual({
      detail: `release_${release}`,
      healthy: true,
      service: "service-member",
    });
  });
});

describe.for([
  [
    "healthResponseing for another application",
    "payload_invalid",
    (): Response => HttpResponse.json({ ok: true, release, service: "service-admin" }),
  ],
  [
    "reporting a failed dependency",
    "status_500",
    (): Response => HttpResponse.json({ error: "処理に失敗しました。" }, { status: 500 }),
  ],
  [
    "returning something other than JSON",
    "body_unreadable",
    (): Response => HttpResponse.text("<!doctype html>"),
  ],
  ["unreachable", "unreachable", (): Response => HttpResponse.error()],
] as const)("an application %s", ([, detail, healthResponse]) => {
  const it = test.extend("healthProbe", async ({}, { onCleanup }) => {
    const healthApi = setupServer(http.get(healthEndpoint, healthResponse));
    healthApi.listen({ onUnhandledRequest: "error" });
    onCleanup(() => {
      healthApi.close();
    });
    return Effect.runPromise(probeService(healthTarget));
  });

  it("is unhealthy", ({ healthProbe }) => {
    expect(healthProbe).toStrictEqual({
      detail,
      healthy: false,
      service: "service-member",
    });
  });
});
