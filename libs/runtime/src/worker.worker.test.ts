import { Effect, ManagedRuntime, Schema } from "effect";
import { assert, describe, it } from "@effect/vitest";
import type { AppServices } from "./index.ts";
import type { Layer } from "effect";
import type { Reporting } from "@template/observability";
import { appLayer } from "./index.ts";
import { env } from "cloudflare:workers";
import { httpStatus } from "@template/observability";
import { recordingSink } from "@template/observability/testing";
import { serveApp } from "./worker.ts";

const authSecret = "worker-test-secret-at-least-32-characters";
const validRoutes = { "/": "home" };
const ReportedLog = Schema.Record(Schema.String, Schema.String);
const UnavailableBody = Schema.Struct({ error: Schema.NonEmptyString });

function environment(overrides: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return {
    ...env,
    APP_ORIGIN: "http://localhost:3001",
    APP_RELEASE: "test",
    ASSETS: { fetch: async (): Promise<Response> => new Response(undefined) },
    AUTH_SECRET: authSecret,
    EMAIL_FROM: "sender@example.test",
    ...overrides,
  };
}

async function servedUnavailable(
  layer: () => Layer.Layer<AppServices, unknown>,
  reporting: Reporting,
): Promise<{ readonly body: unknown; readonly status: number }> {
  const worker = serveApp(
    ManagedRuntime.make(layer()),
    () => Effect.succeed(new Response("reached the route")),
    reporting,
  );
  const response = await worker.fetch(new Request("http://localhost:3001/"));
  return { body: await response.json(), status: response.status };
}

const brokenLayers = [
  {
    fields: '{"_tag":"ConfigurationInvalid","reason":"HTTPS is required outside localhost"}',
    layer: (): Layer.Layer<AppServices, unknown> =>
      appLayer(environment({ APP_ORIGIN: "http://wiki.example.test" }), "user", validRoutes),
    tag: "ConfigurationInvalid",
  },
  {
    fields: '{"_tag":"TelemetryInvalid","reason":"routes"}',
    layer: (): Layer.Layer<AppServices, unknown> =>
      appLayer(environment({}), "user", { "bad path": "home" }),
    tag: "TelemetryInvalid",
  },
] as const;

describe("a worker whose layer cannot be built", () => {
  for (const { fields, layer, tag } of brokenLayers) {
    it.effect(`answers 503 without exposing ${tag} to the client`, () =>
      Effect.gen(function* program() {
        const response = yield* Effect.promise(async () =>
          servedUnavailable(layer, { log: recordingSink().sink, service: "user" }),
        );
        assert.strictEqual(response.status, httpStatus.serviceUnavailable);
        const { error } = yield* Schema.decodeUnknownEffect(UnavailableBody)(response.body);
        assert.notInclude(error, tag);
      }),
    );
    it.effect(`names ${tag} as the cause of the unavailable response`, () =>
      Effect.gen(function* program() {
        const logs = recordingSink();
        yield* Effect.promise(async () =>
          servedUnavailable(layer, { log: logs.sink, service: "user" }),
        );
        assert.lengthOf(logs.stderr, 1);
        const {
          "error.cause": causeSummary,
          "error.fingerprint": fingerprint,
          "error.locations": locations,
          ...reported
        } = yield* Schema.decodeUnknownEffect(ReportedLog)(logs.stderr[0]).pipe(Effect.orDie);
        assert.deepStrictEqual(reported, {
          "error.fields": fields,
          "error.tag": tag,
          "error.type": "Error",
          event: "application.runtime_unavailable",
          service: "user-server",
        });
        assert.match(fingerprint ?? "", /^[0-9a-f]{8}$/u);
        assert.include(causeSummary ?? "", tag);
        assert.notInclude(`${causeSummary}${locations}`, authSecret);
      }),
    );
  }
});
