import { assert, describe, it } from "@effect/vitest";
import { httpStatus } from "@repo/config";
import { recordingSink } from "@repo/observability/testing";
import { appEnvironment } from "@repo/runtime/testing";
import { serveApp, workerRuntime } from "@repo/runtime/worker";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { Effect, Schema } from "effect";

import { wikiLayer, wikiService } from "./wiki.ts";

import type { Reporting } from "@repo/observability";
import type { Layer } from "effect";
import type { WikiServices } from "./wiki.ts";

const validRoutes = { "/": "home" };
const ReportedLog = Schema.Record(Schema.String, Schema.String);
const UnavailableBody = Schema.Struct({ error: Schema.NonEmptyString });

function servedUnavailable(
  layer: () => Layer.Layer<WikiServices, unknown>,
  reporting: Reporting,
): Effect.Effect<{
  readonly body: unknown;
  readonly status: number;
}> {
  return Effect.gen(function* fetchUnavailable() {
    const worker = serveApp({
      runtime: workerRuntime(layer),
      route: () => Effect.succeed(new Response("reached the route")),
      reporting,
    });
    const context = createExecutionContext();
    const response = yield* Effect.promise(() =>
      worker.fetch(new Request("http://localhost:3001/"), {}, context),
    );
    yield* Effect.promise(() => waitOnExecutionContext(context));
    return {
      body: yield* Effect.promise(() => response.json()),
      status: response.status,
    };
  });
}

describe("a wiki worker whose database has not been migrated", () => {
  it.effect("names the missing table that broke the layer", () =>
    Effect.gen(function* program() {
      const logs = recordingSink();
      const response = yield* servedUnavailable(() => wikiLayer(appEnvironment(), validRoutes), {
        log: logs.sink,
        service: wikiService,
      });
      assert.strictEqual(response.status, httpStatus.serviceUnavailable);
      const { error } = yield* Schema.decodeUnknownEffect(UnavailableBody)(response.body);
      assert.notInclude(error, "oauth_resource");
      const reported = yield* Schema.decodeUnknownEffect(ReportedLog)(logs.stderr[0]).pipe(
        Effect.orDie,
      );
      assert.deepInclude(reported, {
        "error.tag": "AuthFailure",
        service: "internal-dashboard-server",
      });
      assert.include(reported["error.chain"] ?? "", "no such table: oauth_resource");
    }),
  );
});
