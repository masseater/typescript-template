import { assert, it } from "@effect/vitest";
import { setupNetwork } from "@msw/cloudflare";
import { Telemetry } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { Effect, Layer } from "effect";
import { HttpResponse, http } from "msw";

import { serveWorker, workerRuntime } from "./worker.ts";

interface Exported {
  readonly logs: readonly unknown[];
  readonly status: number;
  readonly traces: readonly unknown[];
}

const endpoint = "https://otlp.example.test";
const noContent = 204;

const exporting = Layer.orDie(
  Telemetry.layer({
    log: recordingSink().sink,
    otlp: { endpoint },
    release: "abc123",
    routes: { "/": "home" },
    serviceName: "service-member",
  }),
);

function served(): Effect.Effect<Exported> {
  const seen = { logs: [] as unknown[], traces: [] as unknown[] };
  function collect(signal: "logs" | "traces"): Parameters<typeof http.post>[1] {
    return ({ request }) =>
      request.json().then((body) => {
        seen[signal].push(body);
        return HttpResponse.json({});
      });
  }
  function invoke(): Promise<Exported> {
    return Effect.runPromise(
      Effect.gen(function* invokeProgram() {
        const runtime = workerRuntime(() => exporting);
        const worker = serveWorker(
          runtime,
          () => Effect.succeed(new Response(undefined, { status: noContent })),
          { log: recordingSink().sink, service: "service-member" },
        );
        const context = createExecutionContext();
        const response = yield* Effect.promise(() =>
          worker.fetch(new Request("http://localhost/"), {}, context),
        );
        yield* Effect.promise(() => waitOnExecutionContext(context));
        const exported = {
          logs: [...seen.logs],
          status: response.status,
          traces: [...seen.traces],
        };
        yield* Effect.promise(() => runtime.dispose());
        return exported;
      }),
    );
  }
  return Effect.acquireUseRelease(
    Effect.sync(() => {
      const network = setupNetwork();
      network.configure({ onUnhandledFrame: "error" });
      network.use(
        http.post(`${endpoint}/v1/traces`, collect("traces")),
        http.post(`${endpoint}/v1/logs`, collect("logs")),
      );
      network.enable();
      return network;
    }),
    () => Effect.promise(invoke),
    (network) =>
      Effect.sync(() => {
        network.disable();
      }),
  );
}

it.effect("the fetch handler exports its spans and logs before the invocation ends", () =>
  Effect.gen(function* program() {
    const exported = yield* served();
    assert.strictEqual(exported.status, noContent);
    assert.strictEqual(exported.traces.length, 1);
    assert.strictEqual(exported.logs.length, 1);
  }),
);
