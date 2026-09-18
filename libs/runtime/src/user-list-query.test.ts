import { AppOrigin, apiRoutes, compileApi, createApi } from "./http.ts";
import { Effect, Layer, ManagedRuntime, Schema } from "effect";
import { Telemetry, httpStatus } from "@template/observability";
import { assert, describe, it } from "@effect/vitest";
import { UserListQuery } from "./contracts.ts";

const origin = "http://localhost:3002";
const context = Layer.succeed(AppOrigin, origin).pipe(
  Layer.provideMerge(Telemetry.layer({ release: "test", routes: {}, serviceName: "admin" })),
);
const api = apiRoutes(ManagedRuntime.make(context));
const DecodedQuery = Schema.Struct({
  emailVerified: Schema.optionalKey(Schema.Boolean),
  keyword: Schema.optionalKey(Schema.String),
  limit: Schema.Finite,
  offset: Schema.Finite,
  role: Schema.optionalKey(Schema.String),
});
const app = compileApi(
  createApi("/api").get(
    "/users",
    ...api.route(
      { query: UserListQuery, response: DecodedQuery },
      (_request, query) => Effect.succeed(query),
      {},
    ),
  ),
);

function usersRequest(query: string): Effect.Effect<Response> {
  return Effect.promise(async () => app.fetch(new Request(`${origin}/api/users?${query}`)));
}

function decoded(query: string): Effect.Effect<unknown> {
  return usersRequest(query).pipe(
    Effect.flatMap((reply) => Effect.promise(async () => reply.json())),
  );
}

describe("user list query parameters", () => {
  it.effect("decodes paging and every filter the admin user list sends", () =>
    Effect.gen(function* program() {
      const query = yield* decoded(
        "limit=50&offset=100&keyword=%20Alice%20&role=user&emailVerified=false",
      );
      assert.deepStrictEqual(query, {
        emailVerified: false,
        keyword: "Alice",
        limit: 50,
        offset: 100,
        role: "user",
      });
    }),
  );

  it.effect("defaults paging and leaves absent filters out", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* decoded(""), { limit: 50, offset: 0 });
    }),
  );

  it.effect("rejects malformed filters", () =>
    Effect.gen(function* program() {
      for (const query of ["role=owner", "emailVerified=yes", "keyword=", "verified=true"]) {
        const reply = yield* usersRequest(query);
        assert.strictEqual(reply.status, httpStatus.badRequest);
      }
    }),
  );
});
