import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { inheritedEnvironment } from "@repo/config/process-environment";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, vi } from "vite-plus/test";

import { readGitSourceScope } from "./git-ignored-source.ts";
import { gitOutput } from "./git-output.ts";

layer(NodeServices.layer)("readGitSourceScope", (it) => {
  describe("a source under a directory the ignore file names", () => {
    const fixture = Effect.gen(function* ignoredDirectorySourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-ignored-directory-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, ".gitignore"), "dist\n");
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "dist"));
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "dist/status.ts"), "export {};");
      return readGitSourceScope(repositoryRoot).isIgnored(
        paths.join(repositoryRoot, "dist/status.ts"),
      );
    });

    it.effect("is not a repository source", () =>
      Effect.gen(function* program() {
        const ignoredDirectorySourceAnswer = yield* fixture;
        expect(ignoredDirectorySourceAnswer).toBe(true);
      }),
    );
  });

  describe("a directory the ignore file names", () => {
    const fixture = Effect.gen(function* ignoredDirectoryAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-ignored-directory-itself-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, ".gitignore"), "dist\n");
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "dist"));
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "dist/status.ts"), "export {};");
      return readGitSourceScope(repositoryRoot).isIgnored(paths.join(repositoryRoot, "dist"));
    });

    it.effect("is itself ignored", () =>
      Effect.gen(function* program() {
        const ignoredDirectoryAnswer = yield* fixture;
        expect(ignoredDirectoryAnswer).toBe(true);
      }),
    );
  });

  describe("sources under a package directory the scope was built for", () => {
    const fixture = Effect.gen(function* packageSourceAnswers() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-ignored-package-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, ".gitignore"), "dist\n");
      const packageRoot = paths.join(repositoryRoot, "packages/app");
      yield* filesystem.makeDirectory(paths.join(packageRoot, "dist"), { recursive: true });
      yield* filesystem.makeDirectory(paths.join(packageRoot, "src"));
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages/app-sibling/dist"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(paths.join(packageRoot, "dist/status.ts"), "export {};");
      yield* filesystem.writeFileString(paths.join(packageRoot, "src/entry.ts"), "export {};");
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages/app-sibling/dist/status.ts"),
        "export {};",
      );
      const scope = readGitSourceScope(packageRoot);
      return {
        generated: scope.isIgnored(paths.join(packageRoot, "dist/status.ts")),
        authored: scope.isIgnored(paths.join(packageRoot, "src/entry.ts")),
      };
    });

    it.effect("ignore what the repository ignore file names and keep the rest", () =>
      Effect.gen(function* program() {
        const packageSourceAnswers = yield* fixture;
        expect(packageSourceAnswers).toStrictEqual({ generated: true, authored: false });
      }),
    );
  });

  describe("a source whose name matches a suffix pattern in the ignore file", () => {
    const fixture = Effect.gen(function* ignoredSuffixSourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-ignored-suffix-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, ".gitignore"),
        "*.generated.ts\n",
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"));
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "src/status.generated.ts"),
        "export {};",
      );
      return readGitSourceScope(repositoryRoot).isIgnored(
        paths.join(repositoryRoot, "src/status.generated.ts"),
      );
    });

    it.effect("is not a repository source", () =>
      Effect.gen(function* program() {
        const ignoredSuffixSourceAnswer = yield* fixture;
        expect(ignoredSuffixSourceAnswer).toBe(true);
      }),
    );
  });

  describe("a source no pattern in the ignore file reaches", () => {
    const fixture = Effect.gen(function* unmatchedSourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-unmatched-source-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, ".gitignore"),
        "dist\n*.generated.ts\n",
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"));
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src/status.ts"), "export {};");
      return readGitSourceScope(repositoryRoot).isIgnored(
        paths.join(repositoryRoot, "src/status.ts"),
      );
    });

    it.effect("stays a repository source", () =>
      Effect.gen(function* program() {
        const unmatchedSourceAnswer = yield* fixture;
        expect(unmatchedSourceAnswer).toBe(false);
      }),
    );
  });

  describe("a tracked source that a later ignore pattern would match", () => {
    const fixture = Effect.gen(function* trackedSourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-tracked-source-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "dist"));
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "dist/status.ts"), "export {};");
      gitOutput(["add", "dist/status.ts"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, ".gitignore"), "dist\n");
      return readGitSourceScope(repositoryRoot).isIgnored(
        paths.join(repositoryRoot, "dist/status.ts"),
      );
    });

    it.effect("stays a repository source", () =>
      Effect.gen(function* program() {
        const trackedSourceAnswer = yield* fixture;
        expect(trackedSourceAnswer).toBe(false);
      }),
    );
  });

  describe("a source reached through an ignored symbolic-link ancestor", () => {
    const fixture = Effect.gen(function* linkedAncestorSourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-ignored-link-ancestor-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      const externalDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-ignored-link-target-",
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, ".gitignore"),
        ".local-agents\n",
      );
      yield* filesystem.writeFileString(paths.join(externalDirectory, "status.ts"), "export {};");
      yield* filesystem.symlink(externalDirectory, paths.join(repositoryRoot, ".local-agents"));
      return readGitSourceScope(repositoryRoot).isIgnored(
        paths.join(repositoryRoot, ".local-agents/status.ts"),
      );
    });

    it.effect("is not a repository source", () =>
      Effect.gen(function* program() {
        const linkedAncestorSourceAnswer = yield* fixture;
        expect(linkedAncestorSourceAnswer).toBe(true);
      }),
    );
  });

  describe("an ignored source read while the environment names a foreign Git index", () => {
    const fixture = Effect.gen(function* foreignIndexSourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-foreign-index-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, ".gitignore"), "dist\n");
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "dist"));
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "dist/status.ts"), "export {};");
      vi.stubEnv("GIT_INDEX_FILE", paths.join(repositoryRoot, "foreign-index"));
      return readGitSourceScope(repositoryRoot).isIgnored(
        paths.join(repositoryRoot, "dist/status.ts"),
      );
    });

    it.effect("is not a repository source", () =>
      Effect.gen(function* program() {
        const foreignIndexSourceAnswer = yield* fixture;
        expect(foreignIndexSourceAnswer).toBe(true);
      }),
    );
  });

  describe("a source outside the repository the scope was built for", () => {
    const fixture = Effect.gen(function* outsideSourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-ignored-inside-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, ".gitignore"), "*.ts\n");
      const outsideDirectory = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-ignored-outside-",
      });
      yield* filesystem.writeFileString(paths.join(outsideDirectory, "status.ts"), "export {};");
      return readGitSourceScope(repositoryRoot).isIgnored(
        paths.join(outsideDirectory, "status.ts"),
      );
    });

    it.effect("does not inherit the repository ignores", () =>
      Effect.gen(function* program() {
        const outsideSourceAnswer = yield* fixture;
        expect(outsideSourceAnswer).toBe(false);
      }),
    );
  });

  describe("several sources handed to one scope", () => {
    const fixture = Effect.gen(function* ignoredSourcePaths() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-source-scope-filter-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, ".gitignore"), "dist\n");
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "dist"));
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "src"));
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "dist/status.ts"), "export {};");
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "src/status.ts"), "export {};");
      return ["dist/status.ts", "src/status.ts"].filter(
        readGitSourceScope(repositoryRoot).isIgnored,
      );
    });

    it.effect("keeps only the ignored one", () =>
      Effect.gen(function* program() {
        const ignoredSourcePaths = yield* fixture;
        expect(ignoredSourcePaths).toStrictEqual(["dist/status.ts"]);
      }),
    );
  });

  describe("a source under a repository root that does not exist", () => {
    const fixture = Effect.gen(function* missingRootSourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const missingRepositoryRoot = paths.join(
        yield* filesystem.makeTempDirectoryScoped({ prefix: "missing-git-source-scope-" }),
        "absent",
      );
      return readGitSourceScope(missingRepositoryRoot).isIgnored(
        paths.join(missingRepositoryRoot, "dist/status.ts"),
      );
    });

    it.effect("stays a repository source", () =>
      Effect.gen(function* program() {
        const missingRootSourceAnswer = yield* fixture;
        expect(missingRootSourceAnswer).toBe(false);
      }),
    );
  });

  describe("a source under a root that no repository encloses", () => {
    const fixture = Effect.gen(function* unenclosedRootSourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const unenclosedRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-unenclosed-root-",
      });
      return readGitSourceScope(unenclosedRoot).isIgnored(
        paths.join(unenclosedRoot, "dist/status.ts"),
      );
    });

    it.effect("stays a repository source", () =>
      Effect.gen(function* program() {
        const unenclosedRootSourceAnswer = yield* fixture;
        expect(unenclosedRootSourceAnswer).toBe(false);
      }),
    );
  });

  describe("a source under a repository link that resolves to nothing", () => {
    const fixture = Effect.gen(function* unresolvableLinkSourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const unresolvableRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-unresolvable-link-",
      });
      yield* filesystem.writeFileString(
        paths.join(unresolvableRoot, ".git"),
        "gitdir: /nonexistent/git-directory\n",
      );
      return readGitSourceScope(unresolvableRoot).isIgnored(
        paths.join(unresolvableRoot, "dist/status.ts"),
      );
    });

    it.effect("stays a repository source", () =>
      Effect.gen(function* program() {
        const unresolvableLinkSourceAnswer = yield* fixture;
        expect(unresolvableLinkSourceAnswer).toBe(false);
      }),
    );
  });

  describe("an ignored source read through a symbolic repository root", () => {
    const fixture = Effect.gen(function* symbolicRootSourceAnswer() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-symbolic-root-target-",
      });
      gitOutput(["init", "--quiet"], { cwd: repositoryRoot, env: inheritedEnvironment() });
      yield* filesystem.writeFileString(paths.join(repositoryRoot, ".gitignore"), "dist\n");
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "dist"));
      yield* filesystem.writeFileString(paths.join(repositoryRoot, "dist/status.ts"), "export {};");
      const linkParent = yield* filesystem.makeTempDirectoryScoped({
        prefix: "git-symbolic-root-link-",
      });
      const linkedRoot = paths.join(linkParent, "repository");
      yield* filesystem.symlink(repositoryRoot, linkedRoot);
      return readGitSourceScope(linkedRoot).isIgnored(paths.join(repositoryRoot, "dist/status.ts"));
    });

    it.effect("is not a repository source", () =>
      Effect.gen(function* program() {
        const symbolicRootSourceAnswer = yield* fixture;
        expect(symbolicRootSourceAnswer).toBe(true);
      }),
    );
  });
});
