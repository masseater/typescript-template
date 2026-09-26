import { assert, describe, it } from "@effect/vitest";
import { count, eq } from "drizzle-orm";
import { DateTime, Effect } from "effect";

import { bootstrapAdmin } from "./bootstrap-statement.ts";
import { TestDatabase } from "./database-test-fixture.ts";
import { query } from "./database.ts";
import { user } from "./schema.ts";

const recordedAt = DateTime.toDate(DateTime.makeUnsafe("2026-01-01T00:00:00.000Z"));

describe("bootstrapAdmin", () => {
  describe("two verified users bootstrapped at the same time", () => {
    it.effect("promotes exactly one of them", () =>
      Effect.gen(function* bootstrapBoth() {
        yield* query((database) =>
          database.insert(user).values([
            {
              createdAt: recordedAt,
              email: "first@example.com",
              emailVerified: true,
              id: "first",
              name: "first",
              updatedAt: recordedAt,
            },
            {
              createdAt: recordedAt,
              email: "second@example.com",
              emailVerified: true,
              id: "second",
              name: "second",
              updatedAt: recordedAt,
            },
          ]),
        );
        yield* Effect.all(
          [
            Effect.exit(bootstrapAdmin("first@example.com")),
            Effect.exit(bootstrapAdmin("second@example.com")),
          ],
          { concurrency: "unbounded" },
        );
        const administrators = yield* query((database) =>
          database.select({ count: count() }).from(user).where(eq(user.role, "admin")),
        );
        assert.deepStrictEqual(administrators, [{ count: 1 }]);
      }).pipe(Effect.provide(TestDatabase)),
    );
  });
});
