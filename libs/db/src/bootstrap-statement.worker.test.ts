import { count, eq } from "drizzle-orm";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { bootstrapAdmin } from "./bootstrap-statement.ts";
import { query } from "./database.ts";
import { user } from "./schema.ts";
import { addUser, TestDatabase } from "./testing.ts";

describe("bootstrapAdmin", () => {
  describe("two verified users bootstrapped at the same time", () => {
    const it = test.extend("administrators", async () =>
      Effect.runPromise(
        Effect.gen(function* bootstrapBoth() {
          yield* addUser({ userId: "first" });
          yield* addUser({ userId: "second" });
          yield* Effect.all(
            [
              Effect.exit(bootstrapAdmin("first@example.com")),
              Effect.exit(bootstrapAdmin("second@example.com")),
            ],
            { concurrency: "unbounded" },
          );
          return yield* query(async (database) =>
            database.select({ count: count() }).from(user).where(eq(user.role, "admin")),
          );
        }).pipe(Effect.provide(TestDatabase)),
      ));

    it("promotes exactly one of them", ({ administrators }) => {
      expect(administrators).toStrictEqual([{ count: 1 }]);
    });
  });
});
