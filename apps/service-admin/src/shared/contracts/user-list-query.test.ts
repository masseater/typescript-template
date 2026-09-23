import { assert, describe, it } from "@effect/vitest";
import { readSearchParams } from "@repo/runtime/http";
import { Effect } from "effect";

import { UserListQuery } from "./users.ts";

function usersRequest(query: string): Request {
  return new Request(`http://localhost:3002/api/users?${query}`);
}

describe("user list query parameters", () => {
  it.effect("decodes paging and every filter the admin user list sends", () =>
    Effect.gen(function* program() {
      const query = yield* readSearchParams(
        UserListQuery,
        usersRequest(
          "limit=50&offset=100&keyword=%20Alice%20&accountState=active&emailVerified=false",
        ),
      );
      assert.deepStrictEqual(query, {
        emailVerified: false,
        keyword: "Alice",
        limit: 50,
        offset: 100,
        accountState: "active",
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
      for (const query of ["accountState=paid", "emailVerified=yes", "keyword=", "verified=true"]) {
        const failure = yield* readSearchParams(UserListQuery, usersRequest(query)).pipe(
          Effect.flip,
        );
        assert.strictEqual(failure._tag, "InputInvalid");
      }
    }),
  );
});
