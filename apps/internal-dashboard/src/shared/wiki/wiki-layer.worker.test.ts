import { assert, describe, it } from "@effect/vitest";
import { httpStatus } from "@repo/config";
import { recordingSink } from "@repo/observability/testing";
import { appEnvironment } from "@repo/runtime/testing";
import { serveApp, workerRuntime } from "@repo/runtime/worker";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { Effect, Schema } from "effect";

import { wikiLayer, wikiService } from "./wiki.ts";

import type { Flagship } from "@cloudflare/workers-types";
import type { Reporting } from "@repo/observability";
import type { Layer } from "effect";
import type { WikiServices } from "./wiki.ts";

const validRoutes = { "/": "home" };
const ReportedLog = Schema.Record(Schema.String, Schema.String);
const UnavailableBody = Schema.Struct({ error: Schema.NonEmptyString });

const flagshipStub = (): Flagship =>
  ({
    get: (_flagKey: string, defaultValue?: unknown) => Promise.resolve(defaultValue),
    getBooleanDetails: (flagKey: string, defaultValue: boolean) =>
      Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
    getBooleanValue: (_flagKey: string, defaultValue: boolean) => Promise.resolve(defaultValue),
    getNumberDetails: (flagKey: string, defaultValue: number) =>
      Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
    getNumberValue: (_flagKey: string, defaultValue: number) => Promise.resolve(defaultValue),
    getObjectDetails: <T extends object>(flagKey: string, defaultValue: T) =>
      Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
    getObjectValue: <T extends object>(_flagKey: string, defaultValue: T) =>
      Promise.resolve(defaultValue),
    getStringDetails: (flagKey: string, defaultValue: string) =>
      Promise.resolve({ flagKey, reason: "DEFAULT", value: defaultValue }),
    getStringValue: (_flagKey: string, defaultValue: string) => Promise.resolve(defaultValue),
  }) as Flagship;

function servedUnavailable(
  layer: () => Layer.Layer<WikiServices, unknown>,
  reporting: Reporting,
): Effect.Effect<{
  readonly body: unknown;
  readonly status: number;
}> {
  return Effect.gen(function* fetchUnavailable() {
    const worker = serveApp(
      workerRuntime(layer),
      () => Effect.succeed(new Response("reached the route")),
      reporting,
    );
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
      const response = yield* servedUnavailable(
        () => wikiLayer(appEnvironment({ FLAGS: flagshipStub() }), validRoutes),
        {
          log: logs.sink,
          service: wikiService,
        },
      );
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

describe("a wiki worker without FLAGS", () => {
  it.effect("refuses to start instead of falling back to memory flags", () =>
    Effect.gen(function* program() {
      const logs = recordingSink();
      const response = yield* servedUnavailable(() => wikiLayer(appEnvironment(), validRoutes), {
        log: logs.sink,
        service: wikiService,
      });
      assert.strictEqual(response.status, httpStatus.serviceUnavailable);
      const reported = yield* Schema.decodeUnknownEffect(ReportedLog)(logs.stderr[0]).pipe(
        Effect.orDie,
      );
      assert.deepInclude(reported, {
        "error.fields": '{"_tag":"ConfigurationInvalid","reason":"FLAGS"}',
        "error.tag": "ConfigurationInvalid",
        service: "internal-dashboard-server",
      });
    }),
  );
});
