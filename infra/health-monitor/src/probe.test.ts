import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { http, HttpResponse } from "msw";
import type { HttpResponseResolver } from "msw";
import { setupServer } from "msw/node";
import { probeService } from "./probe.ts";
import type { HealthTarget } from "./probe.ts";

const userTarget: HealthTarget = {
  service: "user",
  origin: "https://app.example.com",
};

const probe = (target: HealthTarget, resolver: HttpResponseResolver) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const server = setupServer(http.get(`${target.origin}/api/health`, resolver));
      server.listen({ onUnhandledRequest: "error" });
      return server;
    }),
    () => probeService(target),
    (server) => Effect.sync(() => server.close()),
  );

it.effect("an application reporting its own service name and release is healthy", () =>
  Effect.gen(function* () {
    assert.deepStrictEqual(
      yield* probe(userTarget, () =>
        HttpResponse.json({ ok: true, service: "user", release: "0123456789abcdef" }),
      ),
      { service: "user", healthy: true, detail: "release_0123456789abcdef" },
    );
  }),
);

for (const { name, resolver, detail } of [
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
])
  it.effect(`an application ${name} is unhealthy`, () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* probe(userTarget, resolver), {
        service: "user",
        healthy: false,
        detail,
      });
    }),
  );
