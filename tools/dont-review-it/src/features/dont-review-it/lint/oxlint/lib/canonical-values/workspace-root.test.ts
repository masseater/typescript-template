import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { path } from "../../../../platform/path.ts";
import { findWorkspaceRoot } from "./workspace-root.ts";

layer(NodeServices.layer)("findWorkspaceRoot", (it) => {
  describe("the directory holding the workspace manifest", () => {
    const it = test.extend("root", () => findWorkspaceRoot(repositoryRoot));

    it("is the root", ({ root }) => {
      expect(root).toBe(repositoryRoot);
    });
  });

  describe("a package directory", () => {
    const it = test.extend("root", () =>
      findWorkspaceRoot(path.join(repositoryRoot, "tools/dont-review-it")));

    it("reports the workspace above it rather than itself", ({ root }) => {
      expect(root).toBe(repositoryRoot);
    });
  });

  describe("a directory deeper inside a package", () => {
    const it = test.extend("root", () =>
      findWorkspaceRoot(path.join(repositoryRoot, "tools/dont-review-it/src/lint")));

    it("reports the same workspace above it", ({ root }) => {
      expect(root).toBe(repositoryRoot);
    });
  });

  describe("a directory under no workspace", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const detachedDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "mst-workspace-root-detached-",
      });
      const root = yield* Effect.gen(function* root() {
        const filesystem = yield* FileSystem.FileSystem;
        yield* filesystem.makeDirectory(detachedDirectory, { recursive: true });

        return findWorkspaceRoot(detachedDirectory);
      });
      return { detachedDirectory, root };
    });

    it.effect("keeps itself as the root", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { root, detachedDirectory } = yield* fixtures;
        expect(root).toBe(paths.resolve(detachedDirectory));
      }),
    );
  });
});
