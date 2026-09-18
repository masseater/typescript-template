import { Effect, ManagedRuntime, Schema } from "effect";
import { assert, describe, it } from "@effect/vitest";
import type { AppServices } from "./index.ts";
import type { Layer } from "effect";
import type { LogSink } from "@template/observability";
import { appLayer } from "./index.ts";
import { httpStatus } from "@template/observability";
import { serveApp } from "./worker.ts";

interface RecordedLogs {
  readonly stderr: unknown[];
  readonly stdout: unknown[];
}

const authSecret = "worker-test-secret-at-least-32-characters";
const unavailableBody = { error: "処理に失敗しました。リクエスト ID でログを確認してください。" };
const validRoutes = { "/": "home" };
const ReportedLog = Schema.Record(Schema.String, Schema.String);

function environment(overrides: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return {
    APP_ORIGIN: "http://localhost:3001",
    APP_RELEASE: "test",
    ASSETS: { fetch: async (): Promise<Response> => new Response(undefined) },
    AUTH_SECRET: authSecret,
    DB: { batch: (): void => undefined, prepare: (): void => undefined },
    EMAIL: { send: (): void => undefined },
    EMAIL_FROM: "sender@example.test",
    ...overrides,
  };
}

function recordingSink(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  logs: RecordedLogs,
): LogSink {
  return {
    error: (line) => {
      logs.stderr.push(JSON.parse(line));
    },
    info: (line) => {
      logs.stdout.push(JSON.parse(line));
    },
  };
}

async function servedUnavailable(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  layer: Layer.Layer<AppServices, unknown>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  logs: RecordedLogs,
): Promise<Response> {
  const worker = serveApp(
    ManagedRuntime.make(layer),
    () => Effect.succeed(new Response("reached the route")),
    recordingSink(logs),
  );
  return worker.fetch(new Request("http://localhost:3001/"));
}

const brokenLayers = [
  {
    fields: '{"reason":"HTTPS is required outside localhost"}',
    layer: (): Layer.Layer<AppServices, unknown> =>
      appLayer(environment({ APP_ORIGIN: "http://wiki.example.test" }), "user", validRoutes),
    tag: "ConfigurationInvalid",
  },
  {
    fields: '{"reason":"routes"}',
    layer: (): Layer.Layer<AppServices, unknown> =>
      appLayer(environment({}), "user", { "bad path": "home" }),
    tag: "TelemetryInvalid",
  },
] as const;

describe("a worker whose layer cannot be built", () => {
  for (const { fields, layer, tag } of brokenLayers) {
    it.effect(`names ${tag} as the cause of the unavailable response`, () =>
      Effect.gen(function* program() {
        const logs: RecordedLogs = { stderr: [], stdout: [] };
        const response = yield* Effect.promise(async () => servedUnavailable(layer(), logs));
        assert.strictEqual(response.status, httpStatus.serviceUnavailable);
        assert.deepStrictEqual(yield* Effect.promise(async () => response.json()), unavailableBody);
        assert.lengthOf(logs.stderr, 1);
        const {
          "error.cause": causeSummary,
          "error.fingerprint": fingerprint,
          "error.locations": locations,
          ...reported
        } = yield* Schema.decodeUnknownEffect(ReportedLog)(logs.stderr[0]).pipe(Effect.orDie);
        assert.deepStrictEqual(reported, {
          "error.fields": fields,
          "error.message": "",
          "error.tag": tag,
          "error.type": "Error",
          event: "application.runtime_unavailable",
        });
        assert.match(fingerprint ?? "", /^[0-9a-f]{8}$/u);
        assert.include(causeSummary ?? "", tag);
        assert.notInclude(`${causeSummary}${locations}`, authSecret);
      }),
    );
  }
});
