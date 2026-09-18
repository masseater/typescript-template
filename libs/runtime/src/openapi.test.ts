import { AppOrigin, apiDocs, apiRoot, apiRoutes, compileApi, createApi } from "./http.ts";
import { Effect, JsonSchema, Layer, ManagedRuntime, Schema, SchemaRepresentation } from "effect";
import {
  MemberList,
  MemberListQuery,
  ProfileUpdate,
  ProfileView,
  memberPageSize,
} from "./contracts.ts";
import { Telemetry, httpStatus } from "@template/observability";
import { assert, describe, it } from "@effect/vitest";
import type { Cause } from "effect";

const origin = "http://localhost:3001";
const page = 3;
const context = Layer.succeed(AppOrigin, origin).pipe(
  Layer.provideMerge(Telemetry.layer({ release: "test", routes: {}, serviceName: "user" })),
);
const api = apiRoutes(ManagedRuntime.make(context));
const stored = { email: "reader@example.test", id: "user-1", name: "reader", profile: "自己紹介" };
const members = { members: [], pageSize: memberPageSize, total: page } as const;

const app = compileApi(
  createApi(apiRoot)
    .use(apiDocs("user"))
    .get("/profile", ...api.route({ response: ProfileView }, () => Effect.succeed(stored), {}))
    .get(
      "/members",
      ...api.route(
        { query: MemberListQuery, response: MemberList },
        (_request, query) => Effect.succeed({ ...members, total: query.page }),
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
    .post("/telemetry", ...api.raw(() => Effect.succeed(new Response()), {})),
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

function readJson(reply: Response): Effect.Effect<unknown> {
  return Effect.promise(async () => reply.json());
}

function fetched(path: string): Effect.Effect<Response> {
  return Effect.promise(async () => app.fetch(new Request(`${origin}${path}`)));
}

function documented(): Effect.Effect<typeof Document.Type, unknown> {
  return fetched(`${apiRoot}/docs/json`).pipe(
    Effect.flatMap(readJson),
    Effect.flatMap(readDocument),
  );
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

function served(): Effect.Effect<readonly string[], unknown> {
  return readRoutes(app.routes).pipe(
    Effect.map((routes) =>
      routes
        .filter((route) => route.hooks.detail?.hide !== true)
        .map((route) => `${route.method} ${route.path}`)
        .toSorted(),
    ),
  );
}

function listed(document: typeof Document.Type): readonly string[] {
  return Object.entries(document.paths)
    .flatMap(([path, methods]) =>
      Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    )
    .toSorted();
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

  it.effect("lists the statuses the route's failure table can answer with", () =>
    Effect.gen(function* program() {
      const document = yield* documented();
      const listing = yield* operation(document, "/api/members", "get");
      assert.deepStrictEqual(Object.keys(listing.responses).toSorted(), [
        "200",
        "400",
        "401",
        "403",
        "409",
        "500",
      ]);
    }),
  );

  it.effect("keeps every schema inline so no reference is left dangling", () =>
    Effect.gen(function* program() {
      assert.notInclude(JSON.stringify(yield* documented()), "#/$defs/");
    }),
  );

  it.effect("renders the reference page as html", () =>
    Effect.gen(function* program() {
      const reply = yield* fetched(`${apiRoot}/docs`);
      assert.strictEqual(reply.status, httpStatus.ok);
      assert.include(reply.headers.get("content-type") ?? "", "text/html");
    }),
  );
});

describe("the documented request of a route", () => {
  it.effect("names the same query keys as its contract", () =>
    Effect.gen(function* program() {
      const document = yield* documented();
      const listing = yield* operation(document, "/api/members", "get");
      assert.deepStrictEqual(
        (listing.parameters ?? []).map((parameter) => parameter.name).toSorted(),
        Object.keys(MemberListQuery.fields).toSorted(),
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
});
