import { AppOrigin, apiBridge, createApi, readJsonBody, secureResponse } from "./http.ts";
import { CurrentRequest, Telemetry, httpStatus } from "@template/observability";
import { Effect, Layer, Schema } from "effect";
import { assert, describe, it } from "@effect/vitest";
import { ProfileUpdate } from "./contracts.ts";

const origin = "http://localhost:3001";
const traceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const spanId = "bbbbbbbbbbbbbbbb";
const oversizedBody = 16_385;
const repeatedPrivateText = 10;
const created = 201;
const jsonHeaders = { "content-type": "application/json", origin };
const requestContext = {
  requestId: crypto.randomUUID(),
  spanId,
  traceId,
  traceparent: `00-${traceId}-${spanId}-01`,
};
const telemetry = Telemetry.layer({ release: "test", routes: {}, serviceName: "user" });
const context = Layer.mergeAll(
  Layer.succeed(AppOrigin, origin),
  Layer.succeed(CurrentRequest, requestContext),
).pipe(Layer.provideMerge(telemetry));

function mutation(headers: Readonly<Record<string, string>>, body: string): Request {
  return new Request(`${origin}/api/profile`, { body, headers, method: "PATCH" });
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

describe("api routes", () => {
  it.effect("return validation errors without echoing submitted values", () =>
    Effect.gen(function* program() {
      const { dispatch, route } = apiBridge<AppOrigin>();
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      const handler = route(ProfileUpdate, (request) => readJsonBody(ProfileUpdate, request), {});
      const app = createApi().patch("/api/profile", handler);
      const name = "private-profile-text".repeat(repeatedPrivateText);
      const body = JSON.stringify({ name, profile: 1 });
      const response = yield* dispatch(app, mutation(jsonHeaders, body));
      assert.strictEqual(response.status, httpStatus.badRequest);
      const text = yield* Effect.promise(async () => response.text());
      assert.deepStrictEqual(JSON.parse(text), { error: "入力内容を確認してください。" });
      assert.notInclude(text, "private-profile-text");
    }).pipe(Effect.provide(context)),
  );

  it.effect("encode the response contract and drop fields outside it", () =>
    Effect.gen(function* program() {
      const { dispatch, route } = apiBridge<AppOrigin>();
      const View = Schema.Struct({ id: Schema.String });
      const handler = route(View, () => Effect.succeed({ id: "visible", profile: "private" }), {});
      const app = createApi().get("/api/view", handler);
      const response = yield* dispatch(app, new Request(`${origin}/api/view`));
      assert.strictEqual(response.status, httpStatus.ok);
      assert.deepStrictEqual(yield* Effect.promise(async () => response.json()), { id: "visible" });
      assert.strictEqual(response.headers.get("x-frame-options"), "DENY");
    }).pipe(Effect.provide(context)),
  );

  it.effect("turn unexpected failures into a generic 500 response", () =>
    Effect.gen(function* program() {
      const { dispatch, route } = apiBridge<AppOrigin>();
      const broken = { _tag: "Broken" } as const;
      const handler = route(Schema.Struct({}), () => Effect.fail(broken), { Broken: "unexpected" });
      const app = createApi().get("/api/broken", handler);
      const response = yield* dispatch(app, new Request(`${origin}/api/broken`));
      assert.strictEqual(response.status, httpStatus.internalServerError);
    }).pipe(Effect.provide(context)),
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
