import { count, eq } from "drizzle-orm";
import { Effect, type Layer } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { bootstrapAdmin } from "./bootstrap-statement.ts";
import { query } from "./database.ts";
import { addUser } from "./records-fixture.ts";
import { user } from "./schema.ts";
import { TestDatabase } from "./testing.ts";

const runTest = <Value>(
  program: Effect.Effect<Value, unknown, Layer.Success<typeof TestDatabase>>,
): Promise<Value> => Effect.runPromise(program.pipe(Effect.provide(TestDatabase)));

describe("bootstrapAdmin", () => {
  describe("two verified users bootstrapped at the same time", () => {
    const it = test.extend("administrators", async () =>
      runTest(
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
        }),
      ));

    it("promotes exactly one of them", ({ administrators }) => {
      expect(administrators).toStrictEqual([{ count: 1 }]);
    });
  });
});
