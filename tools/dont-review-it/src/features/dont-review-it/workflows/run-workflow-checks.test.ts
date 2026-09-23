import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "./config.ts";
import { runWorkflowChecks } from "./run-workflow-checks.ts";

layer(NodeServices.layer)("runWorkflowChecks", (it) => {
  describe("a definition that keeps every discipline", () => {
    const scanFixture = Effect.gen(function* scan() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-run-workflow-checks-",
      });
      const directory = paths.join(repositoryRoot, defaultWorkflowChecksConfig.workflowDirectory);
      yield* filesystem.makeDirectory(directory, { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(directory, "ci.yml"),
        `name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    runs-on: ubuntu-latest
    steps:
      - run: vp run guard
`,
      );

      return yield* runWorkflowChecks({ repositoryRoot, config: defaultWorkflowChecksConfig });
    });

    it.effect("says nothing about it and counts the one definition it read", () =>
      Effect.gen(function* program() {
        const scan = yield* scanFixture;
        expect(scan).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("one definition that breaks several disciplines", () => {
    const linesOfTheProblemsFixture = Effect.gen(function* linesOfTheProblems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-run-workflow-checks-",
      });
      const directory = paths.join(repositoryRoot, defaultWorkflowChecksConfig.workflowDirectory);
      yield* filesystem.makeDirectory(directory, { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(directory, "ci.yml"),
        "on:\n  pull_request:\n    paths: [src/**]\njobs:\n  build:\n    steps:\n      - run: npm test || true\n",
      );

      return (yield* runWorkflowChecks({
        repositoryRoot,
        config: defaultWorkflowChecksConfig,
      })).problems.map((problem) => problem.line);
    });

    it.effect("reports them in the order they were written", () =>
      Effect.gen(function* program() {
        const linesOfTheProblems = yield* linesOfTheProblemsFixture;
        expect(linesOfTheProblems).toStrictEqual([3, 5, 7, 7]);
      }),
    );
  });

  describe("a definition whose syntax is broken", () => {
    const messagesOfTheProblemsFixture = Effect.gen(function* messagesOfTheProblems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-run-workflow-checks-",
      });
      const directory = paths.join(repositoryRoot, defaultWorkflowChecksConfig.workflowDirectory);
      yield* filesystem.makeDirectory(directory, { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(directory, "ci.yml"),
        "jobs:\n build:\n   x: 1\n  y: 2\n",
      );

      return (yield* runWorkflowChecks({
        repositoryRoot,
        config: defaultWorkflowChecksConfig,
      })).problems.map((problem) => problem.message);
    });

    it.effect("reports only that the definition cannot be read", () =>
      Effect.gen(function* program() {
        const messagesOfTheProblems = yield* messagesOfTheProblemsFixture;
        expect(messagesOfTheProblems).toStrictEqual([
          "A workflow definition that does not parse must not stay in the repository, because every check below reads it as an empty file and reports nothing. Fix the YAML here so the definition can be read.",
        ]);
      }),
    );
  });

  describe("several definitions that each break a discipline", () => {
    const filesOfTheProblemsFixture = Effect.gen(function* filesOfTheProblems() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-run-workflow-checks-",
      });
      const directory = paths.join(repositoryRoot, defaultWorkflowChecksConfig.workflowDirectory);
      yield* filesystem.makeDirectory(directory, { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(directory, "ci.yml"),
        "jobs:\n  build:\n    steps: []\n",
      );
      yield* filesystem.writeFileString(
        paths.join(directory, "release.yml"),
        "jobs:\n  publish:\n    steps: []\n",
      );

      return (yield* runWorkflowChecks({
        repositoryRoot,
        config: defaultWorkflowChecksConfig,
      })).problems.map((problem) => problem.file);
    });

    it.effect("orders the problems by the file they were found in", () =>
      Effect.gen(function* program() {
        const filesOfTheProblems = yield* filesOfTheProblemsFixture;
        expect(filesOfTheProblems).toStrictEqual([
          ".github/workflows/ci.yml",
          ".github/workflows/release.yml",
        ]);
      }),
    );
  });
});
