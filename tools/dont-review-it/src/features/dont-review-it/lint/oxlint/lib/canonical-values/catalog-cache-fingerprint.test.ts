import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { cacheInputFingerprint } from "./catalog-cache-fingerprint.ts";
import { listRepositoryFiles } from "./source-files.ts";

const LINKED_SOURCE_TEXT = 'export const status = "draft";\n';

layer(NodeServices.layer)("cacheInputFingerprint", (it) => {
  describe("a cache input problem beside a scan that reported none", () => {
    const it = test
      .extend("fingerprintOfAScanWithoutProblems", () => cacheInputFingerprint([]))
      .extend("fingerprintOfAnUnsafeSymbolicLinkProblem", () =>
        cacheInputFingerprint(
          [],
          [{ filePath: "src/link.ts", kind: "unsafe-symbolic-link", line: 1 }],
        ),
      );

    it("gets a different fingerprint, because problems participate in it", ({
      fingerprintOfAnUnsafeSymbolicLinkProblem,
      fingerprintOfAScanWithoutProblems,
    }) => {
      expect(fingerprintOfAnUnsafeSymbolicLinkProblem).not.toBe(fingerprintOfAScanWithoutProblems);
    });
  });

  describe("a source symlink aimed at the second of two files holding identical text", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const fingerprintOfTheTreeAimingAtTheFirstFile = yield* Effect.gen(
        function* fingerprintOfTheTreeAimingAtTheFirstFile() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "canonical-values-",
          });

          yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(repositoryRoot, "src", "first.ts"),
            LINKED_SOURCE_TEXT,
          );
          yield* filesystem.writeFileString(
            paths.join(repositoryRoot, "src", "second.ts"),
            LINKED_SOURCE_TEXT,
          );
          yield* filesystem.symlink("first.ts", paths.join(repositoryRoot, "src", "public.ts"));
          return cacheInputFingerprint(listRepositoryFiles(repositoryRoot).cacheInputs);
        },
      );
      const fingerprintOfTheTreeAimingAtTheSecondFile = yield* Effect.gen(
        function* fingerprintOfTheTreeAimingAtTheSecondFile() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
            prefix: "canonical-values-",
          });

          yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(repositoryRoot, "src", "first.ts"),
            LINKED_SOURCE_TEXT,
          );
          yield* filesystem.writeFileString(
            paths.join(repositoryRoot, "src", "second.ts"),
            LINKED_SOURCE_TEXT,
          );
          yield* filesystem.symlink("second.ts", paths.join(repositoryRoot, "src", "public.ts"));
          return cacheInputFingerprint(listRepositoryFiles(repositoryRoot).cacheInputs);
        },
      );
      return {
        fingerprintOfTheTreeAimingAtTheFirstFile,
        fingerprintOfTheTreeAimingAtTheSecondFile,
      };
    });

    it.effect("gets a different fingerprint from the tree aimed at the first file", () =>
      Effect.gen(function* program() {
        const {
          fingerprintOfTheTreeAimingAtTheSecondFile,
          fingerprintOfTheTreeAimingAtTheFirstFile,
        } = yield* fixtures;
        expect(fingerprintOfTheTreeAimingAtTheSecondFile).not.toBe(
          fingerprintOfTheTreeAimingAtTheFirstFile,
        );
      }),
    );
  });
});
