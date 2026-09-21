import { assert, describe, it } from "@effect/vitest";
import { SessionRequired } from "@repo/auth";
import { APPLICATION } from "@repo/config";
import { Telemetry, httpStatus } from "@repo/observability";
import { Effect, JsonSchema, Layer, Schema, SchemaRepresentation } from "effect";

import { AppOrigin, apiDocs, apiRoot, apiRoutes, createApi, failureBy } from "./http.ts";
import { workerRuntime } from "./worker-runtime.ts";

import type { Cause } from "effect";

class MemberGone extends Schema.TaggedError<MemberGone>()("MemberGone", {}) {}
class Throttled extends Schema.TaggedError<Throttled>()("Throttled", { again: Schema.Boolean }) {}

const origin = "http://localhost:3001";
const page = 3;
const lastPage = 10;
const oversizedBody = 16_385;
const memberPageSize = 24;
const ProfileView = Schema.Struct({
  email: Schema.String,
  id: Schema.String,
  name: Schema.String,
  profile: Schema.String,
});
const ProfileUpdate = Schema.Struct({
  name: Schema.String,
  profile: Schema.String,
});
const MemberListQuery = Schema.Struct({
  keyword: Schema.optionalKey(Schema.String),
  page: Schema.NumberFromString.check(
    Schema.isInt(),
    Schema.isBetween({ maximum: 1_000_000, minimum: 1 }),
  ),
});
const MemberList = Schema.Struct({
  members: Schema.Array(Schema.Unknown),
  pageSize: Schema.Literal(memberPageSize),
  total: Schema.Number,
});
const context = Layer.succeed(AppOrigin, origin).pipe(
  Layer.provideMerge(
    Telemetry.layer({ release: "test", routes: {}, serviceName: APPLICATION.user }),
  ),
);
const api = apiRoutes(
  workerRuntime(() => context),
  { service: APPLICATION.user },
);
const stored = { email: "reader@example.test", id: "user-1", name: "reader", profile: "自己紹介" };
const members = { members: [], pageSize: memberPageSize, total: page } as const;
const Verification = Schema.Struct({ token: Schema.String });
const Named = Schema.Struct({
  name: Schema.String.annotate({ identifier: "Name" }),
  nickname: Schema.String.annotate({ identifier: "Name" }),
});
const loginRequired = { message: "ログインしてください。", status: httpStatus.unauthorized };
const jsonHeaders = { "content-type": "application/json", origin };

function throttledFailure(error: Throttled): {
  readonly message: string;
  readonly status: typeof httpStatus.badRequest | typeof httpStatus.tooManyRequests;
} {
  return error.again
    ? { message: "しばらく待ってください。", status: httpStatus.tooManyRequests }
    : { message: "確認できません。", status: httpStatus.badRequest };
}

const app = createApi(apiRoot)
  .use(apiDocs(APPLICATION.user))
  .get("/profile", ...api.route({ response: ProfileView }, () => Effect.succeed(stored), {}))
  .get(
    "/members",
    ...api.route(
      { query: MemberListQuery, response: MemberList },
      (_request, query) =>
        query.page > lastPage
          ? Effect.fail(new MemberGone())
          : Effect.succeed({ ...members, total: query.page }),
      { MemberGone: { message: "見つかりません。", status: httpStatus.conflict } },
    ),
  )
  .patch(
    "/profile",
    ...api.route(
      { body: ProfileUpdate, response: ProfileView },
      (_request, values) => Effect.succeed({ ...stored, ...values }),
      {},
    ),
  )
  .post(
    "/verify",
    ...api.route(
      { body: Verification, response: Verification },
      (_request, input) =>
        input.token === "ok"
          ? Effect.succeed(input)
          : Effect.fail(new Throttled({ again: input.token === "again" })),
      {
        Throttled: failureBy([httpStatus.tooManyRequests, httpStatus.badRequest], throttledFailure),
      },
    ),
  )
  .post(
    "/named",
    ...api.route({ body: Named, response: Named }, (_r, input) => Effect.succeed(input), {}),
  )
  .post("/telemetry", ...api.raw(() => Effect.succeed(new Response()), {}));

const guardedApp = createApi(apiRoot)
  .use(
    apiDocs(
      APPLICATION.admin,
      api.guard(
        (request) =>
          request.headers.get("cookie") === "session=1"
            ? Effect.void
            : Effect.fail(new SessionRequired()),
        { SessionRequired: loginRequired },
      ),
    ),
  )
  .get("/open", ...api.route({ response: Schema.Struct({}) }, () => Effect.succeed({}), {}));

const unavailableApi = apiRoutes(
  workerRuntime(() => Layer.effect(AppOrigin, Effect.fail("unavailable"))),
  {
    service: APPLICATION.user,
  },
);
const unavailableApp = createApi(apiRoot)
  .use(apiDocs(APPLICATION.user))
  .get(
    "/profile",
    ...unavailableApi.route({ response: ProfileView }, () => Effect.succeed(stored), {}),
  );

const JsonSchemaValue = Schema.Record(Schema.String, Schema.Unknown);
const MediaTypes = Schema.Struct({
  "application/json": Schema.Struct({ schema: JsonSchemaValue }),
});
const JsonBody = Schema.Struct({ content: MediaTypes });
const Parameter = Schema.Struct({ name: Schema.String });
const Operation = Schema.Struct({
  parameters: Schema.optionalKey(Schema.Array(Parameter)),
  requestBody: Schema.optionalKey(JsonBody),
  responses: Schema.Record(Schema.String, JsonBody),
});
const Document = Schema.Struct({
  paths: Schema.Record(Schema.String, Schema.Record(Schema.String, Operation)),
});
const Detail = Schema.Struct({ hide: Schema.optionalKey(Schema.Boolean) });
const Route = Schema.Struct({
  hooks: Schema.Struct({ detail: Schema.optionalKey(Detail) }),
  method: Schema.String,
  path: Schema.String,
});
const readDocument = Schema.decodeUnknownEffect(Document);
const readRoutes = Schema.decodeUnknownEffect(Schema.Array(Route));

type Served = Readonly<{ fetch: (request: Request) => Response | Promise<Response> }>;

function readJson(reply: Response): Effect.Effect<unknown> {
  return Effect.promise(async () => reply.json());
}

function fetchedFrom(target: Served, path: string, init?: RequestInit): Effect.Effect<Response> {
  return Effect.promise(async () => target.fetch(new Request(`${origin}${path}`, init)));
}

function fetched(path: string, init?: RequestInit): Effect.Effect<Response> {
  return fetchedFrom(app, path, init);
}

function documentOf(target: Served): Effect.Effect<typeof Document.Type, unknown> {
  return fetchedFrom(target, `${apiRoot}/docs/json`).pipe(
    Effect.flatMap(readJson),
    Effect.flatMap(readDocument),
  );
}

function documented(): Effect.Effect<typeof Document.Type, unknown> {
  return documentOf(app);
}

function accepts(schema: Readonly<Record<string, unknown>>, value: unknown): boolean {
  const document = JsonSchema.fromSchemaDraft2020_12(schema);
  return Schema.is(SchemaRepresentation.fromJsonSchemaDocument(document, { patterns: "apply" }))(
    value,
  );
}

function bodySchema(body: typeof JsonBody.Type): Readonly<Record<string, unknown>> {
  return body.content["application/json"].schema;
}

function operation(
  document: typeof Document.Type,
  path: string,
  method: string,
): Effect.Effect<typeof Operation.Type, Cause.NoSuchElementError> {
  return Effect.fromNullishOr(document.paths[path]?.[method]);
}

function statusesOf(
  document: typeof Document.Type,
  path: string,
  method: string,
): Effect.Effect<readonly string[], Cause.NoSuchElementError> {
  return operation(document, path, method).pipe(
    Effect.map((found) =>
      Object.keys(found.responses).toSorted((left, right) => left.localeCompare(right)),
    ),
  );
}

function served(): Effect.Effect<readonly string[], unknown> {
  return readRoutes(app.routes).pipe(
    Effect.map((routes) =>
      routes
        .filter((route) => route.hooks.detail?.hide !== true)
        .map((route) => `${route.method} ${route.path}`)
        .toSorted((left, right) => left.localeCompare(right)),
    ),
  );
}

function listed(document: typeof Document.Type): readonly string[] {
  return Object.entries(document.paths)
    .flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    )
    .toSorted((left, right) => left.localeCompare(right));
}

function posted(path: string, headers: Readonly<Record<string, string>>, body: string) {
  return fetched(path, { body, headers, method: path === "/api/profile" ? "PATCH" : "POST" });
}

describe("the api reference document", () => {
  it.effect("describes every route that is not served as a raw response", () =>
    Effect.gen(function* program() {
      const document = yield* documented();
      assert.deepStrictEqual(listed(document), yield* served());
    }),
  );

  it.effect("accepts the response a route actually answers with", () =>
    Effect.gen(function* program() {
      const document = yield* documented();
      const reply = yield* fetched(`${apiRoot}/members?page=${page}`);
      const body = yield* readJson(reply);
      const listing = yield* operation(document, "/api/members", "get");
      const schema = bodySchema(yield* Effect.fromNullishOr(listing.responses["200"]));
      assert.strictEqual(reply.status, httpStatus.ok);
      assert.isTrue(accepts(schema, body));
      assert.isFalse(accepts(schema, { ...members, pageSize: 1 }));
    }),
  );

  it.effect("lists only the statuses each route can answer with", () =>
    Effect.gen(function* program() {
      const document = yield* documented();
      assert.deepStrictEqual(
        {
          members: yield* statusesOf(document, "/api/members", "get"),
          profile: yield* statusesOf(document, "/api/profile", "get"),
          update: yield* statusesOf(document, "/api/profile", "patch"),
          verify: yield* statusesOf(document, "/api/verify", "post"),
        },
        {
          members: ["200", "400", "409", "500", "503"],
          profile: ["200", "500", "503"],
          update: ["200", "400", "403", "413", "415", "500", "503"],
          verify: ["200", "400", "403", "413", "415", "429", "500", "503"],
        },
      );
    }),
  );

  it.effect("documents every status a route actually answers with", () =>
    Effect.gen(function* program() {
      const document = yield* documented();
      const oversized = JSON.stringify({
        name: "x".repeat(oversizedBody),
        profile: "",
      });
      const attempts = [
        ["/api/profile", "patch", posted("/api/profile", jsonHeaders, "{")],
        [
          "/api/profile",
          "patch",
          posted("/api/profile", { ...jsonHeaders, "content-type": "text/plain" }, "{}"),
        ],
        [
          "/api/profile",
          "patch",
          posted("/api/profile", { ...jsonHeaders, origin: "https://other.example.test" }, "{}"),
        ],
        ["/api/profile", "patch", posted("/api/profile", jsonHeaders, oversized)],
        [
          "/api/profile",
          "patch",
          posted("/api/profile", jsonHeaders, JSON.stringify({ name: 1, profile: "" })),
        ],
        [
          "/api/verify",
          "post",
          posted("/api/verify", jsonHeaders, JSON.stringify({ token: "again" })),
        ],
        [
          "/api/verify",
          "post",
          posted("/api/verify", jsonHeaders, JSON.stringify({ token: "no" })),
        ],
        ["/api/members", "get", fetched(`${apiRoot}/members?page=abc`)],
        ["/api/members", "get", fetched(`${apiRoot}/members?page=${lastPage + 1}`)],
      ] as const;
      const answered = new Set<number>();
      for (const [path, method, attempt] of attempts) {
        const reply = yield* attempt;
        answered.add(reply.status);
        assert.include(yield* statusesOf(document, path, method), String(reply.status), path);
      }
      assert.deepStrictEqual(
        [...answered].toSorted((left, right) => left - right),
        [
          httpStatus.badRequest,
          httpStatus.forbidden,
          httpStatus.conflict,
          httpStatus.payloadTooLarge,
          httpStatus.unsupportedMediaType,
          httpStatus.tooManyRequests,
        ].toSorted((left, right) => left - right),
      );
    }),
  );

  it.effect("documents the status a route answers with when its runtime is unavailable", () =>
    Effect.gen(function* program() {
      const reply = yield* fetchedFrom(unavailableApp, `${apiRoot}/profile`);
      const statuses = yield* statusesOf(yield* documentOf(unavailableApp), "/api/profile", "get");
      assert.strictEqual(reply.status, httpStatus.serviceUnavailable);
      assert.include(statuses, String(reply.status));
    }),
  );

  it.effect("keeps every schema inline so no reference is left dangling", () =>
    Effect.gen(function* program() {
      const document = JSON.stringify(yield* documented());
      assert.notInclude(document, "$defs");
      assert.notInclude(document, "$ref");
    }),
  );

  it.effect("renders the reference page as html that may only reach its own origin", () =>
    Effect.gen(function* program() {
      const reply = yield* fetched(`${apiRoot}/docs`);
      assert.strictEqual(reply.status, httpStatus.ok);
      assert.include(reply.headers.get("content-type") ?? "", "text/html");
      assert.include(reply.headers.get("content-security-policy") ?? "", "connect-src 'self'");
    }),
  );
});

describe("a guarded api reference", () => {
  it.effect("answers the guard's failure to a visitor the guard rejects", () =>
    Effect.gen(function* program() {
      const docsPage = yield* fetchedFrom(guardedApp, `${apiRoot}/docs`);
      const document = yield* fetchedFrom(guardedApp, `${apiRoot}/docs/json`);
      const open = yield* fetchedFrom(guardedApp, `${apiRoot}/open`);
      assert.deepStrictEqual(
        [docsPage.status, document.status, open.status],
        [httpStatus.unauthorized, httpStatus.unauthorized, httpStatus.ok],
      );
    }),
  );

  it.effect("serves the reference to a visitor the guard lets through", () =>
    Effect.gen(function* program() {
      const headers = { cookie: "session=1" };
      const docsPage = yield* fetchedFrom(guardedApp, `${apiRoot}/docs`, { headers });
      const document = yield* fetchedFrom(guardedApp, `${apiRoot}/docs/json`, { headers });
      assert.deepStrictEqual([docsPage.status, document.status], [httpStatus.ok, httpStatus.ok]);
    }),
  );
});

describe("the failure table of a route", () => {
  it("names exactly the failures its handler can fail with", () => {
    const handler = () => Effect.fail(new MemberGone());
    const gone = { message: "見つかりません。", status: httpStatus.conflict };
    // @ts-expect-error a failure the handler never raises would be documented
    api.route({ response: Schema.Struct({}) }, handler, { MemberGone: gone, Throttled: gone });
    // @ts-expect-error a failure the handler raises would be answered as 500 undocumented
    api.route({ response: Schema.Struct({}) }, handler, {});
    assert.lengthOf(api.route({ response: Schema.Struct({}) }, handler, { MemberGone: gone }), 2);
  });
});

describe("the documented request of a route", () => {
  it.effect("names the same query keys as its contract", () =>
    Effect.gen(function* program() {
      const document = yield* documented();
      const listing = yield* operation(document, "/api/members", "get");
      assert.deepStrictEqual(
        (listing.parameters ?? [])
          .map((parameter) => parameter.name)
          .toSorted((left, right) => left.localeCompare(right)),
        Object.keys(MemberListQuery.fields).toSorted((left, right) => left.localeCompare(right)),
      );
    }),
  );

  it.effect("accepts the bodies its contract accepts and no others", () =>
    Effect.gen(function* program() {
      const document = yield* documented();
      const update = yield* operation(document, "/api/profile", "patch");
      const schema = bodySchema(yield* Effect.fromNullishOr(update.requestBody));
      assert.isTrue(accepts(schema, { name: "reader", profile: "" }));
      assert.isFalse(accepts(schema, { name: "reader", role: "admin" }));
    }),
  );

  it.effect("inlines a schema that carries an identifier", () =>
    Effect.gen(function* program() {
      const document = yield* documented();
      const named = yield* operation(document, "/api/named", "post");
      const schema = bodySchema(yield* Effect.fromNullishOr(named.requestBody));
      assert.isTrue(accepts(schema, { name: "reader", nickname: "r" }));
      assert.isFalse(accepts(schema, { name: 1, nickname: "r" }));
    }),
  );
});
