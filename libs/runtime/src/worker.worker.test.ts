import { assert, describe, it } from "@effect/vitest";
import { cspNonceHeader } from "@repo/config/security";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { Effect, Schema } from "effect";

import { appEnvironment, fixtureAuthSecret, fixtureOrigin } from "./app-fixture.ts";
import { appLayer } from "./index.ts";
import { serveApp, startRoute, workerRuntime } from "./worker.ts";

import type { Reporting } from "@repo/observability";
import type { Layer } from "effect";
import type { AppServices } from "./index.ts";

const validRoutes = { "/": "home" };
const ReportedLog = Schema.Record(Schema.String, Schema.String);
const UnavailableBody = Schema.Struct({ error: Schema.NonEmptyString });

async function servedUnavailable(
  layer: () => Layer.Layer<AppServices, unknown>,
  reporting: Reporting,
): Promise<{
  readonly body: unknown;
  readonly policy: string | null;
  readonly robots: string | null;
  readonly status: number;
}> {
  const worker = serveApp(
    workerRuntime(layer),
    () => Effect.succeed(new Response("reached the route")),
    reporting,
  );
  const context = createExecutionContext();
  const response = await worker.fetch(new Request(`${fixtureOrigin}/`), {}, context);
  await waitOnExecutionContext(context);
  return {
    body: await response.json(),
    policy: response.headers.get("content-security-policy"),
    robots: response.headers.get("x-robots-tag"),
    status: response.status,
  };
}

const brokenLayers = [
  {
    fields: '{"_tag":"ConfigurationInvalid","reason":"HTTPS is required outside localhost"}',
    layer: (): Layer.Layer<AppServices, unknown> =>
      appLayer(
        appEnvironment({ APP_ORIGIN: "http://wiki.example.test" }),
        "service-member",
        validRoutes,
      ),
    tag: "ConfigurationInvalid",
  },
  {
    fields: '{"_tag":"TelemetryInvalid","reason":"routes"}',
    layer: (): Layer.Layer<AppServices, unknown> =>
      appLayer(appEnvironment(), "service-member", { "bad path": "home" }),
    tag: "TelemetryInvalid",
  },
] as const;

describe("a worker whose layer cannot be built", () => {
  for (const { fields, layer, tag } of brokenLayers) {
    it.effect(`answers 503 without exposing ${tag} to the client`, () =>
      Effect.gen(function* program() {
        const response = yield* Effect.promise(async () =>
          servedUnavailable(layer, { log: recordingSink().sink, service: "service-member" }),
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
          servedUnavailable(layer, { log: logs.sink, service: "service-member" }),
        );
        assert.lengthOf(logs.stderr, 1);
        const {
          "error.cause": causeSummary,
          "error.chain": chain,
          "error.fingerprint": fingerprint,
          "error.locations": locations,
          ...reported
        } = yield* Schema.decodeUnknownEffect(ReportedLog)(logs.stderr[0]).pipe(Effect.orDie);
        assert.deepStrictEqual(reported, {
          "error.fields": fields,
          "error.tag": tag,
          "error.type": "Error",
          event: "application.runtime_unavailable",
          service: "service-member-server",
        });
        assert.match(fingerprint ?? "", /^[0-9a-f]{8}$/u);
        assert.include(causeSummary ?? "", tag);
        assert.strictEqual(chain, "");
        assert.notInclude(`${causeSummary}${locations}`, fixtureAuthSecret);
      }),
    );
  }
});

async function servedDocument(url: string): Promise<Response> {
  const worker = serveApp(
    workerRuntime(() => appLayer(appEnvironment({}), "service-member", validRoutes)),
    startRoute({
      fetch: (rendered: Request): Response =>
        new Response("<!DOCTYPE html>", {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "x-rendered-nonce": rendered.headers.get(cspNonceHeader) ?? "",
          },
        }),
    }),
    { service: "service-member" },
  );
  const context = createExecutionContext();
  const response = await worker.fetch(new Request(url), {}, context);
  await waitOnExecutionContext(context);
  return response;
}

describe("a worker serving a rendered document", () => {
  it.effect("names the nonce it handed the renderer and forbids everything else", () =>
    Effect.gen(function* program() {
      const response = yield* Effect.promise(async () => servedDocument(`${fixtureOrigin}/`));
      const directives = (response.headers.get("content-security-policy") ?? "").split("; ");
      const nonce = response.headers.get("x-rendered-nonce") ?? "";
      assert.match(nonce, /^[\w+/]{22}==$/u);
      assert.include(directives, "default-src 'none'");
      assert.include(directives, `script-src 'nonce-${nonce}' 'strict-dynamic'`);
      assert.notInclude(directives.join("; "), "unsafe-eval");
    }),
  );

  it.effect("demands https for a year once the document arrived over https", () =>
    Effect.gen(function* program() {
      const secure = yield* Effect.promise(async () =>
        servedDocument("https://user.example.test/"),
      );
      const plain = yield* Effect.promise(async () => servedDocument(`${fixtureOrigin}/`));
      assert.strictEqual(
        secure.headers.get("strict-transport-security"),
        "max-age=31536000; includeSubDomains",
      );
      assert.isNull(plain.headers.get("strict-transport-security"));
    }),
  );

  it.effect("forbids every resource and indexing when the runtime cannot answer", () =>
    Effect.gen(function* program() {
      const response = yield* Effect.promise(async () =>
        servedUnavailable(brokenLayers[0].layer, {
          log: recordingSink().sink,
          service: "service-member",
        }),
      );
      assert.include(response.policy ?? "", "default-src 'none'");
      assert.notInclude(response.policy ?? "", "nonce-");
      assert.strictEqual(response.robots, "noindex, nofollow");
    }),
  );
});

describe("a worker answering any request", () => {
  const paths = ["/", "/assets/app.js"] as const;
  for (const path of paths) {
    it.effect(`keeps ${path} out of search indexes`, () =>
      Effect.gen(function* program() {
        const response = yield* Effect.promise(async () =>
          servedDocument(`https://user.example.test${path}`),
        );
        assert.strictEqual(response.headers.get("x-robots-tag"), "noindex, nofollow");
      }),
    );
  }
});
