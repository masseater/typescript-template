import { setupNetwork } from "@msw/cloudflare";
import { httpStatus } from "@repo/config";
import { Telemetry } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { cspNonceHeader } from "@repo/runtime/security";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { Effect, Layer, Ref, Schema } from "effect";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vite-plus/test";

import { appEnvironment, fixtureAuthSecret, fixtureOrigin } from "./app-fixture.ts";
import { appLayer } from "./bindings.ts";
import { appServerEntry, serveApp, serveWorker, workerRuntime } from "./worker.ts";

describe.for([
  [
    "ConfigurationInvalid",
    '{"_tag":"ConfigurationInvalid","reason":"HTTPS is required outside localhost"}',
    { APP_ORIGIN: "http://wiki.example.test" },
    { "/": "home" },
  ],
  ["TelemetryInvalid", '{"_tag":"TelemetryInvalid","reason":"routes"}', {}, { "bad path": "home" }],
] as const)("a worker whose layer fails with %s", ([tag, fields, overrides, routes]) => {
  const it = test
    .extend("unavailableAnswer", () =>
      Effect.runPromise(
        Effect.gen(function* unavailableAnswerProgram() {
          const worker = serveApp({
            reporting: { log: recordingSink().sink, service: "service-member" },
            route: () => Effect.succeed(new Response("reached the route")),
            runtime: workerRuntime(() =>
              appLayer({ audience: "service-member", env: appEnvironment(overrides), routes }),
            ),
          });
          const invocation = createExecutionContext();
          const answered = yield* Effect.promise(() =>
            worker.fetch(new Request(fixtureOrigin), {}, invocation),
          );
          yield* Effect.promise(() => waitOnExecutionContext(invocation));
          const answerBody: unknown = yield* Effect.promise(() => answered.json());
          return { body: answerBody, status: answered.status };
        }),
      ))
    .extend("unavailableReport", () =>
      Effect.runPromise(
        Effect.gen(function* unavailableReportProgram() {
          const logs = recordingSink();
          const worker = serveApp({
            reporting: { log: logs.sink, service: "service-member" },
            route: () => Effect.succeed(new Response("reached the route")),
            runtime: workerRuntime(() =>
              appLayer({ audience: "service-member", env: appEnvironment(overrides), routes }),
            ),
          });
          const invocation = createExecutionContext();
          yield* Effect.promise(() => worker.fetch(new Request(fixtureOrigin), {}, invocation));
          yield* Effect.promise(() => waitOnExecutionContext(invocation));
          const reportedLines = yield* Schema.decodeUnknownEffect(
            Schema.Array(Schema.Record(Schema.String, Schema.String)),
          )(logs.stderr).pipe(Effect.orDie);
          const {
            "error.cause": causeSummary = "",
            "error.fingerprint": fingerprint = "",
            "error.locations": locations = "",
            ...reported
          } = reportedLines[0] ?? {};
          return {
            causeNamesTag: causeSummary.includes(tag),
            fingerprintIsShortHex: /^[0-9a-f]{8}$/u.test(fingerprint),
            reported,
            reportedLineCount: reportedLines.length,
            secretLeaked: `${causeSummary}${locations}`.includes(fixtureAuthSecret),
          };
        }),
      ),
    );

  it(`answers 503 without exposing ${tag} to the client`, ({ unavailableAnswer }) => {
    expect(unavailableAnswer).toStrictEqual({
      body: { error: "処理に失敗しました。リクエスト ID でログを確認してください。" },
      status: httpStatus.serviceUnavailable,
    });
  });

  it(`names ${tag} as the cause of the unavailable response`, ({ unavailableReport }) => {
    expect(unavailableReport).toStrictEqual({
      causeNamesTag: true,
      fingerprintIsShortHex: true,
      reported: {
        "error.chain": "",
        "error.fields": fields,
        "error.tag": tag,
        "error.type": tag,
        event: "application.runtime_unavailable",
        service: "service-member-server",
      },
      reportedLineCount: 1,
      secretLeaked: false,
    });
  });
});

describe("a worker serving a rendered document", () => {
  const it = test
    .extend("documentPolicy", ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* documentPolicyProgram() {
          const runtime = workerRuntime(() =>
            appLayer({
              audience: "service-member",
              env: appEnvironment(),
              routes: { "/": "home" },
            }),
          );
          onCleanup(() => runtime.dispose());
          const worker = appServerEntry({
            reporting: { service: "service-member" },
            routeHandler: {
              fetch: (rendered: Request): Response =>
                new Response("<!DOCTYPE html>", {
                  headers: {
                    "content-type": "text/html; charset=utf-8",
                    "x-rendered-nonce": rendered.headers.get(cspNonceHeader) ?? "",
                  },
                }),
            },
            runtime,
          });
          const invocation = createExecutionContext();
          const answered = yield* Effect.promise(() =>
            worker.fetch(new Request(fixtureOrigin), {}, invocation),
          );
          yield* Effect.promise(() => waitOnExecutionContext(invocation));
          const renderedNonce = answered.headers.get("x-rendered-nonce") ?? "";
          return {
            nonceIsSixteenBytes: /^[\w+/]{22}==$/u.test(renderedNonce),
            policy: (answered.headers.get("content-security-policy") ?? "").replace(
              `'nonce-${renderedNonce}'`,
              "'nonce-(rendered)'",
            ),
          };
        }),
      ))
    .extend("transportSecurity", ({}, { onCleanup }) =>
      Effect.runPromise(
        Effect.gen(function* transportSecurityProgram() {
          const runtime = workerRuntime(() =>
            appLayer({
              audience: "service-member",
              env: appEnvironment(),
              routes: { "/": "home" },
            }),
          );
          onCleanup(() => runtime.dispose());
          const worker = appServerEntry({
            reporting: { service: "service-member" },
            routeHandler: {
              fetch: (): Response =>
                new Response("<!DOCTYPE html>", {
                  headers: { "content-type": "text/html; charset=utf-8" },
                }),
            },
            runtime,
          });
          const invocation = createExecutionContext();
          const secure = yield* Effect.promise(() =>
            worker.fetch(new Request(new URL("https://user.example.test/")), {}, invocation),
          );
          const plain = yield* Effect.promise(() =>
            worker.fetch(new Request(fixtureOrigin), {}, invocation),
          );
          yield* Effect.promise(() => waitOnExecutionContext(invocation));
          return {
            overHttp: plain.headers.get("strict-transport-security"),
            overHttps: secure.headers.get("strict-transport-security"),
          };
        }),
      ),
    )
    .extend("unavailableHeaders", () =>
      Effect.runPromise(
        Effect.gen(function* unavailableHeadersProgram() {
          const worker = serveApp({
            reporting: { log: recordingSink().sink, service: "service-member" },
            route: () => Effect.succeed(new Response("reached the route")),
            runtime: workerRuntime(() =>
              appLayer({
                audience: "service-member",
                env: appEnvironment({ APP_ORIGIN: "http://wiki.example.test" }),
                routes: { "/": "home" },
              }),
            ),
          });
          const invocation = createExecutionContext();
          const answered = yield* Effect.promise(() =>
            worker.fetch(new Request(fixtureOrigin), {}, invocation),
          );
          yield* Effect.promise(() => waitOnExecutionContext(invocation));
          return {
            policy: answered.headers.get("content-security-policy"),
            robots: answered.headers.get("x-robots-tag"),
          };
        }),
      ),
    );

  it("names the nonce it handed the renderer and forbids everything else", ({ documentPolicy }) => {
    expect(documentPolicy).toStrictEqual({
      nonceIsSixteenBytes: true,
      policy: [
        "default-src 'none'",
        "script-src 'nonce-(rendered)' 'strict-dynamic'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "manifest-src 'self'",
        "form-action 'self'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
      ].join("; "),
    });
  });

  it("demands https for a year once the document arrived over https", ({ transportSecurity }) => {
    expect(transportSecurity).toStrictEqual({
      overHttp: null,
      overHttps: "max-age=31536000; includeSubDomains",
    });
  });

  it("forbids every resource and indexing when the runtime cannot answer", ({
    unavailableHeaders,
  }) => {
    expect(unavailableHeaders).toStrictEqual({
      policy:
        "default-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
      robots: "noindex, nofollow",
    });
  });
});

describe.for(["/", "/assets/app.js"])("a worker answering %s", (path) => {
  const it = test.extend("robotsDirective", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* robotsDirectiveProgram() {
        const runtime = workerRuntime(() =>
          appLayer({ audience: "service-member", env: appEnvironment(), routes: { "/": "home" } }),
        );
        onCleanup(() => runtime.dispose());
        const worker = appServerEntry({
          reporting: { service: "service-member" },
          routeHandler: {
            fetch: (): Response =>
              new Response("<!DOCTYPE html>", {
                headers: { "content-type": "text/html; charset=utf-8" },
              }),
          },
          runtime,
        });
        const invocation = createExecutionContext();
        const answered = yield* Effect.promise(() =>
          worker.fetch(new Request(new URL(path, "https://user.example.test")), {}, invocation),
        );
        yield* Effect.promise(() => waitOnExecutionContext(invocation));
        return answered.headers.get("x-robots-tag");
      }),
    ));

  it("keeps the path out of search indexes", ({ robotsDirective }) => {
    expect(robotsDirective).toBe("noindex, nofollow");
  });
});

describe("a worker exporting telemetry", () => {
  const it = test.extend("exportedSignals", ({}, { onCleanup }) =>
    Effect.runPromise(
      Effect.gen(function* exportedSignalsProgram() {
        const otlpEndpoint = "https://otlp.example.test";
        const traceExports = yield* Ref.make<readonly unknown[]>([]);
        const logExports = yield* Ref.make<readonly unknown[]>([]);
        const network = setupNetwork();
        network.configure({ onUnhandledFrame: "error" });
        network.use(
          http.post(`${otlpEndpoint}/v1/traces`, ({ request }) =>
            Effect.runPromise(
              Effect.gen(function* collectTraces() {
                const exported: unknown = yield* Effect.promise(() => request.json());
                yield* Ref.update(traceExports, (earlier) => [...earlier, exported]);
                return HttpResponse.json({});
              }),
            ),
          ),
          http.post(`${otlpEndpoint}/v1/logs`, ({ request }) =>
            Effect.runPromise(
              Effect.gen(function* collectLogs() {
                const exported: unknown = yield* Effect.promise(() => request.json());
                yield* Ref.update(logExports, (earlier) => [...earlier, exported]);
                return HttpResponse.json({});
              }),
            ),
          ),
        );
        network.enable();
        const runtime = workerRuntime(() =>
          Layer.orDie(
            Telemetry.layer({
              log: recordingSink().sink,
              otlp: { endpoint: otlpEndpoint },
              release: "abc123",
              routes: { "/": "home" },
              serviceName: "service-member",
            }),
          ),
        );
        onCleanup(() =>
          Effect.runPromise(
            Effect.promise(() => runtime.dispose()).pipe(
              Effect.ensuring(
                Effect.sync(() => {
                  network.disable();
                }),
              ),
            ),
          ),
        );
        const worker = serveWorker({
          reporting: { log: recordingSink().sink, service: "service-member" },
          route: () => Effect.succeed(new Response(undefined, { status: httpStatus.noContent })),
          runtime,
        });
        const invocation = createExecutionContext();
        const answered = yield* Effect.promise(() =>
          worker.fetch(new Request(fixtureOrigin), {}, invocation),
        );
        yield* Effect.promise(() => waitOnExecutionContext(invocation));
        return {
          exportedLogBatches: (yield* Ref.get(logExports)).length,
          exportedTraceBatches: (yield* Ref.get(traceExports)).length,
          status: answered.status,
        };
      }),
    ));

  it("exports its spans and logs before the invocation ends", ({ exportedSignals }) => {
    expect(exportedSignals).toStrictEqual({
      exportedLogBatches: 1,
      exportedTraceBatches: 1,
      status: httpStatus.noContent,
    });
  });
});
