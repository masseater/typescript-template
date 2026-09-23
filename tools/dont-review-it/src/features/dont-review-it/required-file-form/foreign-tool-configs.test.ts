import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultRequiredFileFormConfig } from "./config.ts";
import { foreignToolConfigsIn } from "./foreign-tool-configs.ts";

const PACKAGE_ROOT = ".";

layer(NodeServices.layer)("foreignToolConfigsIn", (it) => {
  describe("a package root holding no configuration the type checker misses", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "foreign-tool-configs-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "vite.config.ts"),
        "export default {};\n",
      );
      return yield* foreignToolConfigsIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it.effect("says nothing about it", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([]);
      }),
    );
  });

  describe("a package root holding a configuration in a format the type checker never reads", () => {
    const problemsFixture = Effect.gen(function* problems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "foreign-tool-configs-",
      });

      yield* filesystem.writeFileString(paths.join(repositoryRoot, ".oxlintrc.json"), "{}\n");
      return yield* foreignToolConfigsIn({
        repositoryRoot,
        packageRoot: PACKAGE_ROOT,
        config: defaultRequiredFileFormConfig,
      });
    });

    it.effect("names the spelling the tool reads instead", () =>
      Effect.gen(function* program() {
        const problems = yield* problemsFixture;
        expect(problems).toStrictEqual([
          {
            file: ".oxlintrc.json",
            line: null,
            message:
              "A configuration for oxlint must not stay in a format the type checker never reads. Move what it declares into vite.config.ts.",
          },
        ]);
      }),
    );
  });
});
