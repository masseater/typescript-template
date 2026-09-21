import { assert, describe, it } from "@effect/vitest";
import { InputInvalid } from "@repo/runtime/http";
import { Effect, Schema } from "effect";

import { UserListQuery } from "./users.ts";

function usersQuery(query: string): unknown {
  return Object.fromEntries(new URL(`http://localhost:3002/api/users?${query}`).searchParams);
}

function decode(query: string): Effect.Effect<typeof UserListQuery.Type, InputInvalid> {
  return Schema.decodeUnknownEffect(UserListQuery, { onExcessProperty: "error" })(
    usersQuery(query),
  ).pipe(Effect.mapError(() => new InputInvalid()));
}

describe("user list query parameters", () => {
  it.effect("decodes paging and every filter the admin user list sends", () =>
    Effect.gen(function* program() {
      const query = yield* decode(
        "limit=50&offset=100&keyword=%20Alice%20&accountState=active&emailVerified=false",
      );
      assert.deepStrictEqual(query, {
        accountState: "active",
        emailVerified: false,
        keyword: "Alice",
        limit: 50,
        offset: 100,
      });
    }),
  );

  it.effect("defaults paging and leaves absent filters out", () =>
    Effect.gen(function* program() {
      assert.deepStrictEqual(yield* decode(""), {
        limit: 50,
        offset: 0,
      });
    }),
  );

  it.effect("rejects malformed filters", () =>
    Effect.gen(function* program() {
      for (const query of ["accountState=paid", "emailVerified=yes", "keyword=", "verified=true"]) {
        const failure = yield* decode(query).pipe(Effect.flip);
        assert.strictEqual(failure._tag, "InputInvalid");
      }
    }),
  );
});
