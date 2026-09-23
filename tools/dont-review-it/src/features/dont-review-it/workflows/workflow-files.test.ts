import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "./config.ts";
import { readWorkflowDocuments } from "./workflow-files.ts";

layer(NodeServices.layer)("readWorkflowDocuments", (it) => {
  describe("a repository whose .github tree omits the workflows directory", () => {
    it.effect("is told apart from an empty scan", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-workflow-files-",
        });
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".github"));
        expect(
          yield* readWorkflowDocuments({
            repositoryRoot,
            config: defaultWorkflowChecksConfig,
          }),
        ).toStrictEqual({ kind: "workflows-omitted" });
      }),
    );
  });

  describe("a repository that has no .github tree", () => {
    it.effect("reads no workflows rather than inventing a CI layout", () =>
      Effect.gen(function* program() {
        const filesystem = yield* FileSystem.FileSystem;
        expect(
          yield* readWorkflowDocuments({
            repositoryRoot: yield* filesystem.makeTempDirectoryScoped({
              prefix: "dont-review-it-workflow-files-",
            }),
            config: defaultWorkflowChecksConfig,
          }),
        ).toStrictEqual({ kind: "no-ci-tree" });
      }),
    );
  });

  describe("a directory holding both spellings of the extension beside a file that is no workflow", () => {
    const pathsOfTheDocumentsFixture = Effect.gen(function* pathsOfTheDocuments() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-workflow-files-",
      });
      const directory = paths.join(repositoryRoot, defaultWorkflowChecksConfig.workflowDirectory);
      yield* filesystem.makeDirectory(directory, { recursive: true });
      yield* filesystem.writeFileString(paths.join(directory, "release.yaml"), "name: Release\n");
      yield* filesystem.writeFileString(paths.join(directory, "ci.yml"), "name: CI\n");
      yield* filesystem.writeFileString(paths.join(directory, "README.md"), "# not a workflow\n");

      const tree = yield* readWorkflowDocuments({
        repositoryRoot,
        config: defaultWorkflowChecksConfig,
      });
      return tree.kind === "read" ? tree.documents.map((document) => document.relativePath) : tree;
    });

    it.effect("reads both definitions and leaves the other file alone", () =>
      Effect.gen(function* program() {
        const pathsOfTheDocuments = yield* pathsOfTheDocumentsFixture;
        expect(pathsOfTheDocuments).toStrictEqual([
          ".github/workflows/ci.yml",
          ".github/workflows/release.yaml",
        ]);
      }),
    );
  });
});
