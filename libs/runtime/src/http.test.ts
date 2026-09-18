import {
  AppOrigin,
  apiRoutes,
  compileApi,
  createApi,
  elysiaServer,
  readJsonBody,
  secureResponse,
} from "./http.ts";
import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { Telemetry, httpStatus } from "@template/observability";
import { assert, describe, it } from "@effect/vitest";
import type { AnyElysia } from "elysia";
import { ProfileUpdate } from "./contracts.ts";
import { startRoute } from "./worker.ts";

const origin = "http://localhost:3001";
const oversizedBody = 16_385;
const repeatedPrivateText = 10;
const created = 201;
const jsonHeaders = { "content-type": "application/json", origin };
const telemetry = Telemetry.layer({ release: "test", routes: {}, serviceName: "user" });
const context = Layer.succeed(AppOrigin, origin).pipe(Layer.provideMerge(telemetry));
const runtime = ManagedRuntime.make(context);
const api = apiRoutes(runtime);

function mutation(headers: Readonly<Record<string, string>>, body: string): Request {
  return new Request(`${origin}/api/profile`, { body, headers, method: "PATCH" });
}

function servedThroughStart(app: AnyElysia): (request: Request) => Effect.Effect<Response> {
  const { handlers } = elysiaServer(app);
  const byMethod: Readonly<Record<string, (typeof handlers)["GET"]>> = handlers;
  return startRoute({
    fetch: async (request: Request): Promise<Response> => {
      const handle = byMethod[request.method];
      return handle === undefined
        ? new Response(undefined, { status: httpStatus.methodNotAllowed })
        : handle({ request });
    },
  });
}

async function callApi(app: AnyElysia, request: Request): Promise<Response> {
  return Effect.runPromise(servedThroughStart(compileApi(app))(request));
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
      const body = JSON.stringify({ name: " 利用者 ", profile: "自己紹介です。" });
      const decoded = yield* readJsonBody(ProfileUpdate, mutation(jsonHeaders, body));
      assert.deepStrictEqual(decoded, { name: "利用者", profile: "自己紹介です。" });
    }).pipe(Effect.provide(context)),
  );

  for (const { headers, body, reason } of rejections) {
    it.effect(`rejects mutation because of ${reason}`, () =>
      Effect.gen(function* program() {
        const failure = yield* readJsonBody(ProfileUpdate, mutation(headers, body)).pipe(
          Effect.flip,
        );
        assert.deepStrictEqual(
          { reason: "reason" in failure ? failure.reason : undefined, tag: failure._tag },
          { reason, tag: "RequestRejected" },
        );
      }).pipe(Effect.provide(context)),
    );
  }

  it.effect("rejects unknown fields such as a self-assigned role", () =>
    Effect.gen(function* program() {
      const body = JSON.stringify({ name: "reader", profile: "", role: "admin" });
      const failure = yield* readJsonBody(ProfileUpdate, mutation(jsonHeaders, body)).pipe(
        Effect.flip,
      );
      assert.strictEqual(failure._tag, "InputInvalid");
    }).pipe(Effect.provide(context)),
  );
});

describe("api routes behind a start server route", () => {
  const echo = api.route(
    { body: ProfileUpdate, response: ProfileUpdate },
    (_request, values) => Effect.succeed(values),
    {},
  );

  it.effect("return validation errors without echoing submitted values", () =>
    Effect.gen(function* program() {
      const app = createApi("").patch("/api/profile", ...echo);
      const name = "private-profile-text".repeat(repeatedPrivateText);
      const body = JSON.stringify({ name, profile: 1 });
      const response = yield* Effect.promise(async () => callApi(app, mutation(jsonHeaders, body)));
      assert.strictEqual(response.status, httpStatus.badRequest);
      const text = yield* Effect.promise(async () => response.text());
      assert.deepStrictEqual(JSON.parse(text), { error: "入力内容を確認してください。" });
      assert.notInclude(text, "private-profile-text");
    }),
  );

  for (const { headers, body, reason } of rejections) {
    it.effect(`keeps the request body readable so ${reason} is still rejected`, () =>
      Effect.gen(function* program() {
        const app = createApi("").patch("/api/profile", ...echo);
        const response = yield* Effect.promise(async () => callApi(app, mutation(headers, body)));
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
      const handler = api.route(
        { response: View },
        () => Effect.succeed({ id: "visible", profile: "x" }),
        {},
      );
      const app = createApi("").get("/api/view", ...handler);
      const response = yield* Effect.promise(async () =>
        callApi(app, new Request(`${origin}/api/view`)),
      );
      assert.strictEqual(response.status, httpStatus.ok);
      assert.deepStrictEqual(yield* Effect.promise(async () => response.json()), { id: "visible" });
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
      const handler = api.route({ response: Schema.Struct({}) }, () => Effect.fail(broken), {
        Broken: "unexpected",
      });
      const app = createApi("").get("/api/broken", ...handler);
      const response = yield* Effect.promise(async () =>
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
        { response: Schema.Struct({ id: Schema.String }) },
        () => Effect.succeed({ id: "visible" }),
        {},
      );
      const app = createApi("").get("/api/view", ...handler);
      const response = yield* Effect.promise(async () =>
        callApi(app, new Request(`${origin}/api/view`, { method: "HEAD" })),
      );
      assert.strictEqual(response.status, httpStatus.ok);
    }),
  );

  it.effect("answer an unknown path with the same json failure shape", () =>
    Effect.gen(function* program() {
      const app = createApi("").get(
        "/api/view",
        ...api.route({ response: Schema.Struct({}) }, () => Effect.succeed({}), {}),
      );
      const response = yield* Effect.promise(async () =>
        callApi(app, new Request(`${origin}/api/missing`)),
      );
      assert.strictEqual(response.status, httpStatus.notFound);
      assert.include(response.headers.get("content-type") ?? "", "application/json");
      assert.deepStrictEqual(yield* Effect.promise(async () => response.json()), {
        error: "見つかりませんでした。",
      });
    }),
  );
});

describe("secure responses", () => {
  it.effect("keep status and body while preventing cached private responses", () =>
    Effect.gen(function* program() {
      const response = secureResponse(Response.json({ ready: true }, { status: created }));
      assert.strictEqual(response.status, created);
      assert.deepStrictEqual(yield* Effect.promise(async () => response.json()), { ready: true });
      assert.deepStrictEqual(
        [response.headers.get("cache-control"), response.headers.get("referrer-policy")],
        ["no-store", "no-referrer"],
      );
      assert.strictEqual(response.headers.get("x-frame-options"), "DENY");
    }),
  );
});
