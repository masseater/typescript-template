import { localDatabasePlatform } from "@repo/db-local/platform";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

describe("localDatabasePlatform", () => {
  test("opens a disposable wrangler platform proxy for the local D1 store", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* openAndRead() {
          const platform = yield* localDatabasePlatform;
          expect(Object.keys(platform.env)).toContain("DB");
        }),
      ),
    ));
});
