import { NodeServices } from "@effect/platform-node";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

describe("missing database rows", () => {
  const it = test.extend("nullCoalescingSources", () =>
    Effect.runPromise(
      Effect.gen(function* nullCoalescingSources() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const sourceDirectory = paths.join(repositoryRoot, "libs/db/src");
        const sourceFiles = (yield* filesystem.readDirectory(sourceDirectory)).filter(
          (sourceFile) => sourceFile.endsWith(".ts") && !sourceFile.includes(".test."),
        );
        return yield* Effect.filter(sourceFiles, (sourceFile) =>
          Effect.map(
            filesystem.readFileString(paths.join(sourceDirectory, sourceFile)),
            (sourceText) => /\?\?\s*null\b/u.test(sourceText),
          ),
        );
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("are never coalesced to null", ({ nullCoalescingSources }) => {
    expect(nullCoalescingSources).toStrictEqual([]);
  });
});
