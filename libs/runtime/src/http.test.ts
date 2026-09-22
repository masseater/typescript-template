import { assert, describe, it } from "@effect/vitest";
import { httpStatus } from "@repo/config";
import { Telemetry } from "@repo/observability";
import { cspNonceHeader, strictTransportSecurity } from "@repo/runtime/security";
import { Effect, Layer, Schema } from "effect";

import {
  AppOrigin,
  apiRoutes,
  createApi,
  elysiaServer,
  readJsonBody,
  secureResponse,
} from "./http.ts";
import { startRoute, workerRuntime } from "./worker.ts";

import type { AnyElysia } from "elysia";

const EchoBody = Schema.Struct({
  name: Schema.Trim.check(Schema.isLengthBetween(1, 100)),
  profile: Schema.String.check(Schema.isMaxLength(2000)),
  socialLinks: Schema.Array(
    Schema.String.check(
      Schema.isMaxLength(2048),
      Schema.makeFilter(
        (value: string) => URL.parse(value)?.protocol === "https:" || "https URL required",
      ),
    ),
  ).check(Schema.isMaxLength(10)),
});

const origin = "http://localhost:3001";
const secureOrigin = "https://user.example.test";
const oversizedBody = 16_385;
const repeatedPrivateText = 10;
const created = 201;
const jsonHeaders = { "content-type": "application/json", origin };
const telemetry = Telemetry.layer({ release: "test", routes: {}, serviceName: "service-member" });
const context = Layer.succeed(AppOrigin, origin).pipe(Layer.provideMerge(telemetry));
const runtime = workerRuntime(() => context);
const api = apiRoutes(runtime, { service: "service-member" });

function mutation(headers: Readonly<Record<string, string>>, body: string): Request {
  return new Request(`${origin}/api/profile`, { body, headers, method: "PATCH" });
}

function servedThroughStart(app: AnyElysia): (request: Request) => Effect.Effect<Response> {
  const { handlers } = elysiaServer(app);
  return startRoute({
    fetch: (request: Request): Promise<Response> => {
      const handle = request.method === "HEAD" ? handlers.HEAD : handlers.ANY;
      return handle({ request });
    },
  });
}

function callApi(app: AnyElysia, request: Request): Promise<Response> {
  return Effect.runPromise(servedThroughStart(app)(request));
}

function servedDocument(
  request: Request,
): Effect.Effect<{ readonly headers: Headers; readonly rendered: string | undefined }> {
  const route = startRoute({
    fetch: (rendered: Request): Response =>
      new Response("<!DOCTYPE html>", {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "x-rendered-nonce": rendered.headers.get(cspNonceHeader) ?? "",
        },
      }),
  });
  return route(request).pipe(
    Effect.map((response) => ({
      headers: response.headers,
      rendered: response.headers.get("x-rendered-nonce") ?? undefined,
    })),
  );
}

function policyDirectives(policy: string | null): readonly string[] {
  return (policy ?? "").split("; ");
}

function handedNonce(policy: string | null): string | undefined {
  return /'nonce-(?<nonce>[^']+)'/u.exec(policy ?? "")?.groups?.["nonce"];
}

function documentDirectives(
  nonce: string | undefined,
  googleAnalytics: boolean = false,
): readonly string[] {
  return [
    "default-src 'none'",
    googleAnalytics
      ? `script-src 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com`
      : `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    googleAnalytics
      ? "img-src 'self' data: https://www.google-analytics.com"
      : "img-src 'self' data:",
    "font-src 'self'",
    googleAnalytics
      ? "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com"
      : "connect-src 'self'",
    "manifest-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ];
}

const rejections = [
  {
    body: "{}",
    headers: { ...jsonHeaders, origin: "https://other.example.test" },
    reason: "origin_denied",
  },
  {
    body: "{}",
    headers: { ...jsonHeaders, "content-type": "text/plain" },
    reason: "json_required",
  },
  { body: "{", headers: jsonHeaders, reason: "invalid_json" },
  { body: "x".repeat(oversizedBody), headers: jsonHeaders, reason: "body_too_large" },
] as const;

describe("json request bodies", () => {
  it.effect("reads a bounded same-origin JSON mutation", () =>
    Effect.gen(function* program() {
      const body = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        name: " 利用者 ",
        profile: "自己紹介です。",
        socialLinks: ["https://github.com/example"],
      });
      const decoded = yield* readJsonBody(EchoBody, mutation(jsonHeaders, body));
      assert.deepStrictEqual(decoded, {
        name: "利用者",
        profile: "自己紹介です。",
        socialLinks: ["https://github.com/example"],
      });
    }).pipe(Effect.provide(context)),
  );

  for (const { headers, body, reason } of rejections) {
    it.effect(`rejects mutation because of ${reason}`, () =>
      Effect.gen(function* program() {
        const failure = yield* readJsonBody(EchoBody, mutation(headers, body)).pipe(Effect.flip);
        assert.deepStrictEqual(
          { reason: "reason" in failure ? failure.reason : undefined, tag: failure._tag },
          { reason, tag: "RequestRejected" },
        );
      }).pipe(Effect.provide(context)),
    );
  }

  it.effect("rejects unknown fields such as a self-assigned role", () =>
    Effect.gen(function* program() {
      const body = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        name: "reader",
        profile: "",
        role: "admin",
        socialLinks: [],
      });
      const failure = yield* readJsonBody(EchoBody, mutation(jsonHeaders, body)).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "InputInvalid");
    }).pipe(Effect.provide(context)),
  );
});

describe("api routes behind a start server route", () => {
  const echo = api.route(EchoBody, (request) => readJsonBody(EchoBody, request), {});

  it.effect("return validation errors without echoing submitted values", () =>
    Effect.gen(function* program() {
      const app = createApi("").patch("/api/profile", echo);
      const name = "private-profile-text".repeat(repeatedPrivateText);
      const body = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        name,
        profile: 1,
      });
      const response = yield* Effect.promise(() => callApi(app, mutation(jsonHeaders, body)));
      assert.strictEqual(response.status, httpStatus.badRequest);
      const text = yield* Effect.promise(() => response.text());
      assert.deepStrictEqual(
        yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(text),
        {
          error: "入力内容を確認してください。",
        },
      );
      assert.notInclude(text, "private-profile-text");
    }),
  );

  for (const { headers, body, reason } of rejections) {
    it.effect(`keeps the request body readable so ${reason} is still rejected`, () =>
      Effect.gen(function* program() {
        const app = createApi("").patch("/api/profile", echo);
        const response = yield* Effect.promise(() => callApi(app, mutation(headers, body)));
        assert.isAtLeast(response.status, httpStatus.badRequest);
        assert.isBelow(response.status, httpStatus.internalServerError);
      }),
    );
  }
});

describe("api responses behind a start server route", () => {
  it.effect("encode the response contract and drop fields outside it", () =>
    Effect.gen(function* program() {
      const View = Schema.Struct({ id: Schema.String });
      const handler = api.route(View, () => Effect.succeed({ id: "visible", profile: "x" }), {});
      const app = createApi("").get("/api/view", handler);
      const response = yield* Effect.promise(() => callApi(app, new Request(`${origin}/api/view`)));
      assert.strictEqual(response.status, httpStatus.ok);
      assert.deepStrictEqual(yield* Effect.promise(() => response.json()), { id: "visible" });
      assert.deepStrictEqual(
        [
          response.headers.get("x-frame-options"),
          response.headers.get("cache-control"),
          response.headers.get("referrer-policy"),
          response.headers.get("x-content-type-options"),
        ],
        ["DENY", "no-store", "no-referrer", "nosniff"],
      );
    }),
  );

  it.effect("turn unexpected failures into a generic 500 response", () =>
    Effect.gen(function* program() {
      const broken = { _tag: "Broken" } as const;
      const handler = api.route(Schema.Struct({}), () => Effect.fail(broken), {
        Broken: "unexpected",
      });
      const app = createApi("").get("/api/broken", handler);
      const response = yield* Effect.promise(() =>
        callApi(app, new Request(`${origin}/api/broken`)),
      );
      assert.strictEqual(response.status, httpStatus.internalServerError);
    }),
  );
});

describe("api methods behind a start server route", () => {
  it.effect("answer HEAD on every route that answers GET", () =>
    Effect.gen(function* program() {
      const handler = api.route(
        Schema.Struct({ id: Schema.String }),
        () => Effect.succeed({ id: "visible" }),
        {},
      );
      const app = createApi("").get("/api/view", handler);
      const response = yield* Effect.promise(() =>
        callApi(app, new Request(`${origin}/api/view`, { method: "HEAD" })),
      );
      assert.strictEqual(response.status, httpStatus.ok);
    }),
  );

  it.effect("answer an unknown path with the same json failure shape", () =>
    Effect.gen(function* program() {
      const app = createApi("").get(
        "/api/view",
        api.route(Schema.Struct({}), () => Effect.succeed({}), {}),
      );
      const response = yield* Effect.promise(() =>
        callApi(app, new Request(`${origin}/api/missing`)),
      );
      assert.strictEqual(response.status, httpStatus.notFound);
      assert.include(response.headers.get("content-type") ?? "", "application/json");
      assert.deepStrictEqual(yield* Effect.promise(() => response.json()), {
        error: "見つかりませんでした。",
      });
    }),
  );
});

describe("secure responses", () => {
  it.effect("keep status and body while preventing cached private responses", () =>
    Effect.gen(function* program() {
      const response = secureResponse(
        new Request(origin),
        Response.json({ ready: true }, { status: created }),
      );
      assert.strictEqual(response.status, created);
      assert.deepStrictEqual(yield* Effect.promise(() => response.json()), { ready: true });
      assert.deepStrictEqual(
        [response.headers.get("cache-control"), response.headers.get("referrer-policy")],
        ["no-store", "no-referrer"],
      );
      assert.strictEqual(response.headers.get("x-frame-options"), "DENY");
    }),
  );

  it.effect("forbid every resource an api response has no use for", () =>
    Effect.sync(() => {
      const response = secureResponse(new Request(origin), Response.json({ ready: true }));
      assert.strictEqual(
        response.headers.get("content-security-policy"),
        "default-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
      );
    }),
  );

  it.effect("demand https for a year once the request itself arrived over https", () =>
    Effect.sync(() => {
      const secure = secureResponse(new Request(secureOrigin), Response.json({}));
      const plain = secureResponse(new Request(origin), Response.json({}));
      assert.strictEqual(secure.headers.get("strict-transport-security"), strictTransportSecurity);
      assert.isNull(plain.headers.get("strict-transport-security"));
    }),
  );
});

describe("documents behind a start server route", () => {
  it.effect("name the nonce the renderer was handed and nothing weaker", () =>
    Effect.gen(function* program() {
      const { headers } = yield* servedDocument(new Request(origin));
      const nonce = handedNonce(headers.get("content-security-policy"));
      assert.match(nonce ?? "", /^[\w+/]{22}==$/u);
      assert.deepStrictEqual(
        policyDirectives(headers.get("content-security-policy")),
        documentDirectives(nonce),
      );
    }),
  );

  it.effect("hand the renderer the very nonce the policy names", () =>
    Effect.gen(function* program() {
      const { headers, rendered } = yield* servedDocument(new Request(origin));
      assert.strictEqual(rendered, handedNonce(headers.get("content-security-policy")));
    }),
  );

  it.effect("draw a fresh nonce for every document", () =>
    Effect.gen(function* program() {
      const first = yield* servedDocument(new Request(origin));
      const second = yield* servedDocument(new Request(origin));
      assert.notStrictEqual(first.rendered, second.rendered);
    }),
  );

  it.effect("never let a caller supply the nonce the policy will name", () =>
    Effect.gen(function* program() {
      const forged = "Zm9yZ2VkLW5vbmNlLTAwMA==";
      const { headers } = yield* servedDocument(
        new Request(origin, { headers: { [cspNonceHeader]: forged } }),
      );
      assert.notInclude(headers.get("content-security-policy") ?? "", forged);
    }),
  );

  it.effect("demand https for a year once the document arrived over https", () =>
    Effect.gen(function* program() {
      const { headers } = yield* servedDocument(new Request(secureOrigin));
      assert.strictEqual(headers.get("strict-transport-security"), strictTransportSecurity);
    }),
  );

  it.effect("allow google analytics hosts only when analytics is configured", () =>
    Effect.gen(function* program() {
      const enabled = startRoute(
        {
          fetch: (rendered: Request): Response =>
            new Response("<!DOCTYPE html>", {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "x-rendered-nonce": rendered.headers.get(cspNonceHeader) ?? "",
              },
            }),
        },
        { googleAnalytics: true },
      );
      const { headers } = yield* enabled(new Request(origin));
      assert.deepStrictEqual(
        policyDirectives(headers.get("content-security-policy")),
        documentDirectives(handedNonce(headers.get("content-security-policy")), true),
      );
    }),
  );
});
