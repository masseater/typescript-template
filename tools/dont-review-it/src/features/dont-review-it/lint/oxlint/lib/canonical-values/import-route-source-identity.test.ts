import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { repositoryModuleLocation } from "./import-route-source-identity.ts";

layer(NodeServices.layer)("repositoryModuleLocation", (it) => {
  describe("a symlink standing outside the repository and pointing into it", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const theRootHoldingAnExternalSymlink = yield* Effect.gen(
        function* theRootHoldingAnExternalSymlink() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "canonical-values-",
          });

          yield* filesystem.makeDirectory(paths.join(fixtureRoot, "repository", "src"), {
            recursive: true,
          });
          yield* filesystem.writeFileString(
            paths.join(fixtureRoot, "repository", "src", "status.ts"),
            "export const status = 1;\n",
          );
          yield* filesystem.symlink(
            paths.join(fixtureRoot, "repository", "src", "status.ts"),
            paths.join(fixtureRoot, "status.ts"),
          );
          return fixtureRoot;
        },
      );
      const theLocationOfAnExternalSymlink = repositoryModuleLocation({
        repositoryRoot: paths.join(theRootHoldingAnExternalSymlink, "repository"),
        resolvedPath: paths.join(theRootHoldingAnExternalSymlink, "status.ts"),
      });
      return { theRootHoldingAnExternalSymlink, theLocationOfAnExternalSymlink };
    });

    it.effect("keeps the physical repository identity of the module", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const { theRootHoldingAnExternalSymlink, theLocationOfAnExternalSymlink } = yield* fixtures;
        expect(theLocationOfAnExternalSymlink).toStrictEqual({
          kind: "repository",
          path: paths.join(
            yield* filesystem.realPath(theRootHoldingAnExternalSymlink),
            "repository",
            "src",
            "status.ts",
          ),
          sourcePaths: [
            paths.join(
              yield* filesystem.realPath(theRootHoldingAnExternalSymlink),
              "repository",
              "src",
              "status.ts",
            ),
          ],
        });
      }),
    );
  });

  describe("a symlink standing inside the repository and pointing into it", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const paths = yield* Path.Path;
      const theRootHoldingALexicalSymlink = yield* Effect.gen(
        function* theRootHoldingALexicalSymlink() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "canonical-values-",
          });

          yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(repositoryRoot, "src", "status.ts"),
            "export const status = 1;\n",
          );
          yield* filesystem.symlink(
            paths.join(repositoryRoot, "src", "status.ts"),
            paths.join(repositoryRoot, "status.ts"),
          );
          return repositoryRoot;
        },
      );
      const theLocationOfALexicalSymlink = repositoryModuleLocation({
        repositoryRoot: theRootHoldingALexicalSymlink,
        resolvedPath: paths.join(theRootHoldingALexicalSymlink, "status.ts"),
      });
      return { theRootHoldingALexicalSymlink, theLocationOfALexicalSymlink };
    });

    it.effect("keeps both the physical and the lexical source identity", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const { theRootHoldingALexicalSymlink, theLocationOfALexicalSymlink } = yield* fixtures;
        expect(theLocationOfALexicalSymlink).toStrictEqual({
          kind: "repository",
          path: paths.join(
            yield* filesystem.realPath(theRootHoldingALexicalSymlink),
            "src",
            "status.ts",
          ),
          sourcePaths: [
            paths.join(
              yield* filesystem.realPath(theRootHoldingALexicalSymlink),
              "src",
              "status.ts",
            ),
            paths.join(theRootHoldingALexicalSymlink, "status.ts"),
          ],
        });
      }),
    );
  });
});
