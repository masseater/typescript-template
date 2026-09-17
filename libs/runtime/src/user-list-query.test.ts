import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";
import { UserListQuery } from "./contracts.ts";
import { readSearchParams } from "./http.ts";

function usersRequest(query: string): Request {
  return new Request(`http://localhost:3002/api/users?${query}`);
}

describe("user list query parameters", () => {
  it.effect("decodes paging and every filter the admin user list sends", () =>
    Effect.gen(function* program() {
      const query = yield* readSearchParams(
        UserListQuery,
        usersRequest("limit=50&offset=100&keyword=%20Alice%20&role=user&verified=false"),
      );
      assert.deepStrictEqual(query, {
        keyword: "Alice",
        limit: 50,
        offset: 100,
        role: "user",
        verified: "false",
      });
    }),
  );

  it.effect("defaults paging and leaves absent filters out", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* readSearchParams(UserListQuery, usersRequest("")), {
        limit: 50,
        offset: 0,
      });
    }),
  );

  it.effect("rejects malformed filters", () =>
    Effect.gen(function* program() {
      for (const query of ["role=owner", "verified=yes", "keyword=", "unknown=1"]) {
        const failure = yield* readSearchParams(UserListQuery, usersRequest(query)).pipe(
          Effect.flip,
        );
        assert.strictEqual(failure._tag, "InputInvalid");
      }
    }),
  );
});
