import { localDatabasePlatform } from "@repo/db-local/platform";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

describe("localDatabasePlatform", () => {
  test("opens a disposable wrangler platform proxy for the local D1 store", async () => {
    const bindings = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* openAndRead() {
          const platform = yield* localDatabasePlatform;
          return Object.keys(platform.env);
        }),
      ),
    );
    expect(bindings).toContain("DB");
  });
});
