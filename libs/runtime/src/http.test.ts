import { assert, it } from "@effect/vitest";
import { CurrentRequest, Telemetry } from "@template/observability";
import { Effect, Layer, Schema } from "effect";
import { ProfileUpdate } from "./contracts.ts";
import { AppOrigin, apiBridge, createApi, readJsonBody, secureResponse } from "./http.ts";

const origin = "http://localhost:3001";
const context = Layer.mergeAll(
  Layer.succeed(AppOrigin, origin),
  Layer.succeed(CurrentRequest, {
    traceId: "a".repeat(32),
    spanId: "b".repeat(16),
    requestId: crypto.randomUUID(),
    traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
  }),
).pipe(Layer.provideMerge(Telemetry.layer({ serviceName: "user", release: "test", routes: {} })));

const mutation = (headers: Record<string, string>, body: string) =>
  new Request(`${origin}/api/profile`, { method: "PATCH", headers, body });

it.effect("reads a bounded same-origin JSON mutation", () =>
  Effect.gen(function* () {
    const body = { name: " 利用者 ", profile: "自己紹介です。" };
    const decoded = yield* readJsonBody(
      ProfileUpdate,
      mutation({ origin, "content-type": "application/json" }, JSON.stringify(body)),
    );
    assert.deepStrictEqual(decoded, { name: "利用者", profile: "自己紹介です。" });
  }).pipe(Effect.provide(context)),
);

for (const { headers, body, reason } of [
  {
    headers: { origin: "https://other.example.test", "content-type": "application/json" },
    body: "{}",
    reason: "origin_denied",
  },
  { headers: { origin, "content-type": "text/plain" }, body: "{}", reason: "json_required" },
  { headers: { origin, "content-type": "application/json" }, body: "{", reason: "invalid_json" },
  {
    headers: { origin, "content-type": "application/json" },
    body: "x".repeat(16385),
    reason: "body_too_large",
  },
] as const)
  it.effect(`rejects mutation because of ${reason}`, () =>
    Effect.gen(function* () {
      const failure = yield* readJsonBody(ProfileUpdate, mutation(headers, body)).pipe(Effect.flip);
      assert.strictEqual(failure._tag, "RequestRejected");
      assert.strictEqual(failure._tag === "RequestRejected" && failure.reason, reason);
    }).pipe(Effect.provide(context)),
  );

it.effect("rejects unknown fields such as a self-assigned role", () =>
  Effect.gen(function* () {
    const failure = yield* readJsonBody(
      ProfileUpdate,
      mutation(
        { origin, "content-type": "application/json" },
        JSON.stringify({ name: "reader", profile: "", role: "admin" }),
      ),
    ).pipe(Effect.flip);
    assert.strictEqual(failure._tag, "InputInvalid");
  }).pipe(Effect.provide(context)),
);

it.effect("routes return validation errors without echoing submitted values", () =>
  Effect.gen(function* () {
    const { dispatch, route } = apiBridge<AppOrigin>();
    const app = createApi().patch(
      "/api/profile",
      route(ProfileUpdate, (request) => readJsonBody(ProfileUpdate, request), {}),
    );
    const response = yield* dispatch(
      app,
      mutation(
        { origin, "content-type": "application/json" },
        JSON.stringify({ name: "private-profile-text".repeat(10), profile: 1 }),
      ),
    );
    assert.strictEqual(response.status, 400);
    const text = yield* Effect.promise(() => response.text());
    assert.deepStrictEqual(JSON.parse(text), { error: "入力内容を確認してください。" });
    assert.notInclude(text, "private-profile-text");
  }).pipe(Effect.provide(context)),
);

it.effect("routes encode the response contract and drop fields outside it", () =>
  Effect.gen(function* () {
    const { dispatch, route } = apiBridge<AppOrigin>();
    const View = Schema.Struct({ id: Schema.String });
    const app = createApi().get(
      "/api/view",
      route(View, () => Effect.succeed({ id: "visible", profile: "private" }), {}),
    );
    const response = yield* dispatch(app, new Request(`${origin}/api/view`));
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(yield* Effect.promise(() => response.json()), { id: "visible" });
    assert.strictEqual(response.headers.get("x-frame-options"), "DENY");
  }).pipe(Effect.provide(context)),
);

it.effect("unexpected failures become a generic 500 response", () =>
  Effect.gen(function* () {
    const { dispatch, route } = apiBridge<AppOrigin>();
    class Broken extends Schema.TaggedError<Broken>()("Broken", {}) {}
    const app = createApi().get(
      "/api/broken",
      route(Schema.Struct({}), () => Effect.fail(new Broken()), { Broken: "unexpected" }),
    );
    const response = yield* dispatch(app, new Request(`${origin}/api/broken`));
    assert.strictEqual(response.status, 500);
  }).pipe(Effect.provide(context)),
);

it("keeps status and body while preventing cached private responses", async () => {
  const response = secureResponse(Response.json({ ready: true }, { status: 201 }));
  assert.strictEqual(response.status, 201);
  assert.deepStrictEqual(await response.json(), { ready: true });
  assert.strictEqual(response.headers.get("cache-control"), "no-store");
  assert.strictEqual(response.headers.get("referrer-policy"), "no-referrer");
  assert.strictEqual(response.headers.get("x-frame-options"), "DENY");
});
