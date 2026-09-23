import { count, eq } from "drizzle-orm";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { bootstrapAdmin } from "./bootstrap-statement.ts";
import { query } from "./database.ts";
import { user } from "./schema.ts";
import { TestDatabase } from "./testing.ts";

const recordedAt = new Date("2026-01-01T00:00:00.000Z");

describe("bootstrapAdmin", () => {
  describe("two verified users bootstrapped at the same time", () => {
    const it = test.extend("administrators", async () =>
      Effect.runPromise(
        Effect.gen(function* bootstrapBoth() {
          yield* query(async (database): Promise<void> => {
            await database.insert(user).values([
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
            ]);
          });
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
