import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { ruleSourceFilesIn } from "./rule-source-files.ts";

const WORKSPACE = { workspaceDir: "packages/example", ruleDirectories: ["src/rules"] };

layer(NodeServices.layer)("ruleSourceFilesIn", (it) => {
  describe("a declared directory that does not exist", () => {
    const candidatesFixture = Effect.gen(function* candidates() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-source-files-" });

      return yield* ruleSourceFilesIn({ repositoryRoot: root, workspace: WORKSPACE });
    });

    it.effect("is named as absent instead of yielding no rule", () =>
      Effect.gen(function* program() {
        const candidates = yield* candidatesFixture;
        expect(candidates).toStrictEqual({ sourcePaths: [], absentDirectories: ["src/rules"] });
      }),
    );
  });

  describe("a declared directory holding tests, type declarations, and prose", () => {
    const candidatesFixture = Effect.gen(function* candidates() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-source-files-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(root, "packages/example/src/rules/keep.ts"), "");
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/keep.test.ts"),
        "",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/ambient.d.ts"),
        "",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/notes.md"),
        "",
      );
      return yield* ruleSourceFilesIn({ repositoryRoot: root, workspace: WORKSPACE });
    });

    it.effect("leaves the tests, the type declarations, and the prose out", () =>
      Effect.gen(function* program() {
        const candidates = yield* candidatesFixture;
        expect(candidates).toStrictEqual({
          sourcePaths: ["src/rules/keep.ts"],
          absentDirectories: [],
        });
      }),
    );
  });

  describe("a declared directory holding builds, dependencies, coverage, and shared code", () => {
    const candidatesFixture = Effect.gen(function* candidates() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-source-files-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules/nested"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules/node_modules"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules/dist"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules/coverage"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules/lib"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/nested/inner.ts"),
        "",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/node_modules/vendored.ts"),
        "",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/dist/built.ts"),
        "",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/coverage/report.ts"),
        "",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/lib/shared.ts"),
        "",
      );
      return yield* ruleSourceFilesIn({ repositoryRoot: root, workspace: WORKSPACE });
    });

    it.effect("walks none of those directories and keeps the plain nested one", () =>
      Effect.gen(function* program() {
        const candidates = yield* candidatesFixture;
        expect(candidates).toStrictEqual({
          sourcePaths: ["src/rules/nested/inner.ts"],
          absentDirectories: [],
        });
      }),
    );
  });

  describe("a workspace declaring more than one rule directory", () => {
    const candidatesFixture = Effect.gen(function* candidates() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "rule-source-files-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/rules"), {
        recursive: true,
      });
      yield* filesystem.makeDirectory(paths.join(root, "packages/example/src/more-rules"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/zebra.ts"),
        "",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/rules/alpha.ts"),
        "",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages/example/src/more-rules/extra.ts"),
        "",
      );
      return yield* ruleSourceFilesIn({
        repositoryRoot: root,
        workspace: { ...WORKSPACE, ruleDirectories: ["src/rules", "src/more-rules"] },
      });
    });

    it.effect("lets every declared directory contribute and comes back sorted", () =>
      Effect.gen(function* program() {
        const candidates = yield* candidatesFixture;
        expect(candidates).toStrictEqual({
          sourcePaths: ["src/more-rules/extra.ts", "src/rules/alpha.ts", "src/rules/zebra.ts"],
          absentDirectories: [],
        });
      }),
    );
  });
});
