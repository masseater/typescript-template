import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, it } from "vite-plus/test";

describe("missing database rows", () => {
  it("does not coalesce an absent row to null", () =>
    Effect.runPromise(
      Effect.gen(function* scanSources() {
        const filesystem = yield* FileSystem.FileSystem;
        const hostPath = yield* Path.Path;
        const sourceDirectory = hostPath.dirname(
          yield* hostPath.fromFileUrl(new URL("./", import.meta.url)),
        );
        const names = yield* filesystem.readDirectory(sourceDirectory);
        const productionSources = names.filter(
          (name) => name.endsWith(".ts") && !name.includes(".test."),
        );
        const coalesced: string[] = [];
        for (const name of productionSources) {
          const source = yield* filesystem.readFileString(hostPath.join(sourceDirectory, name));
          if (/\?\?\s*null\b/u.test(source)) {
            coalesced.push(name);
          }
        }
        expect.hasAssertions();
        expect(coalesced).toStrictEqual([]);
      }).pipe(Effect.orDie, Effect.provide(NodeServices.layer)),
    ));
});
