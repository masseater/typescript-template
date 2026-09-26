import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { localDatabasePlatform } from "./local-platform.ts";

describe("localDatabasePlatform", () => {
  it("opens a disposable wrangler platform proxy for the local D1 store", () =>
    Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* openAndRead() {
          const platform = yield* localDatabasePlatform;
          const bindingNames = Object.keys(platform.env).filter((name) => name === "DB");
          expect(bindingNames).toStrictEqual(["DB"]);
        }),
      ),
    ));
});
