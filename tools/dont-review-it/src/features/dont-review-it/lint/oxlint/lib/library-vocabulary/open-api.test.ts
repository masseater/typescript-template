import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { describe, expect } from "vite-plus/test";

import { openTypeScriptApi } from "./open-api.ts";

layer(NodeServices.layer)("openTypeScriptApi", (it) => {
  describe("a directory holding no package of its own", () => {
    const fixture = Effect.gen(function* closedApi() {
      const filesystem = yield* FileSystem.FileSystem;
      const packageDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "open-type-script-api-",
      });

      openTypeScriptApi(packageDirectory).close();
    });

    it.effect("hands back an API that closes on the directory it was opened at", () =>
      Effect.gen(function* program() {
        const closedApi = yield* fixture;
        expect(closedApi).toBe(undefined);
      }),
    );
  });
});
