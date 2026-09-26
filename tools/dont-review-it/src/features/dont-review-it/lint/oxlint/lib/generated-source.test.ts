import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { inheritedEnvironment } from "@repo/config/process-environment";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { generatedSourcePaths } from "./generated-source.ts";
import { gitOutput } from "./git-output.ts";

layer(NodeServices.layer)("generatedSourcePaths", (it) => {
  describe("sources the attributes file marks, sets to true, and leaves unspecified", () => {
    const fixture = Effect.gen(function* markedSources() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "generated-source-marked-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, ".gitattributes"),
        "**/routes.gen.ts linguist-generated\nworker.js linguist-generated=true\nhand.ts -linguist-generated\n",
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src/app"), { recursive: true });
      return generatedSourcePaths({
        repositoryRoot,
        relativePaths: ["src/app/routes.gen.ts", "worker.js", "hand.ts", "src/app/page.ts"],
      });
    });

    it.effect("answers only the marked and true ones, whether git tracks them or not", () =>
      Effect.gen(function* program() {
        const generated = yield* fixture;
        expect([...generated].toSorted()).toStrictEqual(["src/app/routes.gen.ts", "worker.js"]);
      }),
    );
  });

  describe("a directory outside any repository", () => {
    const fixture = Effect.gen(function* unversionedSources() {
      const filesystem = yield* FileSystem.FileSystem;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "generated-source-unversioned-",
      });
      return generatedSourcePaths({ repositoryRoot, relativePaths: ["routeTree.gen.ts"] });
    });

    it.effect("marks nothing as generated", () =>
      Effect.gen(function* program() {
        const generated = yield* fixture;
        expect([...generated]).toStrictEqual([]);
      }),
    );
  });
});
