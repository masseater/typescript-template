import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { Effect } from "effect";
import { HttpResponse, http } from "msw";

import { probeService } from "./probe.ts";

import type { HttpResponseResolver } from "msw";
import type { ProbeResult } from "./probe.ts";

const release = "0".repeat(16);

function otherServiceHealth(): Response {
  return HttpResponse.json({ ok: true, release, service: "admin" });
}

function failedDependency(): Response {
  return HttpResponse.json({ error: "処理に失敗しました。" }, { status: 500 });
}

function htmlPage(): Response {
  return HttpResponse.text("<!doctype html>");
}

function networkError(): Response {
  return HttpResponse.error();
}

const userTarget: Parameters<typeof probeService>[0] = {
  origin: "https://app.example.com",
  service: "user",
};

function probe(
  target: Parameters<typeof probeService>[0],
  resolver: HttpResponseResolver,
): Effect.Effect<ProbeResult> {
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      const network = setupNetwork();
      network.configure({ onUnhandledFrame: "error" });
      network.use(http.get(`${target.origin}/api/health`, resolver));
      network.enable();
      return network;
    }),
    () => probeService(target),
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );
}

it.effect("an application reporting its own service name and release is healthy", () =>
  Effect.gen(function* program() {
    assert.deepStrictEqual(
      yield* probe(userTarget, () => HttpResponse.json({ ok: true, release, service: "user" })),
      { detail: `release_${release}`, healthy: true, service: "user" },
    );
  }),
);

for (const { name, resolver, detail } of [
  {
    detail: "payload_invalid",
    name: "answering for another application",
    resolver: otherServiceHealth,
  },
  {
    detail: "status_500",
    name: "reporting a failed dependency",
    resolver: failedDependency,
  },
  {
    detail: "body_unreadable",
    name: "returning something other than JSON",
    resolver: htmlPage,
  },
  { detail: "unreachable", name: "unreachable", resolver: networkError },
]) {
  it.effect(`an application ${name} is unhealthy`, () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* probe(userTarget, resolver), {
        detail,
        healthy: false,
        service: "user",
      });
    }),
  );
}
