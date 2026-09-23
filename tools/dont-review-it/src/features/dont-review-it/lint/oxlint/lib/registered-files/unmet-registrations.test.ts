import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { UNSCANNED_DIRECTORY_NAMES } from "../repository-scan/worktree-files.ts";
import { unmetRegistrationsIn } from "./unmet-registrations.ts";

const REASON = "the release job reads it";

const UNCHECKED_CONTENT =
  "What this file holds is read by no check, so this row asks only that it exists and holds something.";

layer(NodeServices.layer)("unmetRegistrationsIn", (it) => {
  describe("a registered path holding a file", () => {
    const fixture = Effect.gen(function* registrationsOfAPathHoldingAFile() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

      yield* filesystem.writeFileString(paths.join(root, "CHANGELOG.md"), "released\n");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("leaves the row met", () =>
      Effect.gen(function* program() {
        const registrationsOfAPathHoldingAFile = yield* fixture;
        expect(registrationsOfAPathHoldingAFile).toStrictEqual(new Map());
      }),
    );
  });

  describe("a registered path with nothing at it", () => {
    const fixture = Effect.gen(function* registrationsOfAPathWithNothingAtIt() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("is reported against the repository root", () =>
      Effect.gen(function* program() {
        const registrationsOfAPathWithNothingAtIt = yield* fixture;
        expect(registrationsOfAPathWithNothingAtIt).toStrictEqual(
          new Map([
            [
              ".",
              [
                {
                  workspace: ".",
                  messageId: "missingRegisteredFile",
                  data: {
                    registeredPath: "CHANGELOG.md",
                    holder: "the repository root",
                    reason: REASON,
                    contentGuarantee: UNCHECKED_CONTENT,
                  },
                },
              ],
            ],
          ]),
        );
      }),
    );
  });

  describe("a registered path holding an empty file", () => {
    const fixture = Effect.gen(function* registrationsOfAPathHoldingAnEmptyFile() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

      yield* filesystem.writeFileString(paths.join(root, "CHANGELOG.md"), "");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("is reported as unmet as well", () =>
      Effect.gen(function* program() {
        const registrationsOfAPathHoldingAnEmptyFile = yield* fixture;
        expect(registrationsOfAPathHoldingAnEmptyFile).toStrictEqual(
          new Map([
            [
              ".",
              [
                {
                  workspace: ".",
                  messageId: "emptyRegisteredFile",
                  data: {
                    registeredPath: "CHANGELOG.md",
                    holder: "the repository root",
                    reason: REASON,
                    contentGuarantee: UNCHECKED_CONTENT,
                  },
                },
              ],
            ],
          ]),
        );
      }),
    );
  });

  describe("a registered path holding nothing but blank space", () => {
    const fixture = Effect.gen(function* registrationsOfAPathHoldingBlankSpace() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

      yield* filesystem.writeFileString(paths.join(root, "CHANGELOG.md"), "\n  \n");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("holds nothing", () =>
      Effect.gen(function* program() {
        const registrationsOfAPathHoldingBlankSpace = yield* fixture;
        expect(registrationsOfAPathHoldingBlankSpace).toStrictEqual(
          new Map([
            [
              ".",
              [
                {
                  workspace: ".",
                  messageId: "emptyRegisteredFile",
                  data: {
                    registeredPath: "CHANGELOG.md",
                    holder: "the repository root",
                    reason: REASON,
                    contentGuarantee: UNCHECKED_CONTENT,
                  },
                },
              ],
            ],
          ]),
        );
      }),
    );
  });

  describe("a pattern one matched file holds something at", () => {
    const fixture = Effect.gen(function* registrationsOfAPatternOneFileHolds() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

      yield* filesystem.makeDirectory(paths.join(root, "docs", "lint"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "docs", "lint", "first.md"), "");
      yield* filesystem.writeFileString(paths.join(root, "docs", "lint", "second.md"), "written\n");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "docs/lint/*.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("is met, whatever else the pattern matches", () =>
      Effect.gen(function* program() {
        const registrationsOfAPatternOneFileHolds = yield* fixture;
        expect(registrationsOfAPatternOneFileHolds).toStrictEqual(new Map());
      }),
    );
  });

  describe("a pattern matched only by empty files", () => {
    const fixture = Effect.gen(function* registrationsOfAPatternOnlyEmptyFilesMatch() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

      yield* filesystem.makeDirectory(paths.join(root, "docs", "lint"), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, "docs", "lint", "first.md"), "");
      yield* filesystem.writeFileString(paths.join(root, "docs", "lint", "second.md"), "");
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "docs/lint/*.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("reports each path it matched", () =>
      Effect.gen(function* program() {
        const registrationsOfAPatternOnlyEmptyFilesMatch = yield* fixture;
        expect(registrationsOfAPatternOnlyEmptyFilesMatch).toStrictEqual(
          new Map([
            [
              ".",
              [
                {
                  workspace: ".",
                  messageId: "emptyRegisteredFile",
                  data: {
                    registeredPath: "docs/lint/first.md",
                    holder: "the repository root",
                    reason: REASON,
                    contentGuarantee: UNCHECKED_CONTENT,
                  },
                },
                {
                  workspace: ".",
                  messageId: "emptyRegisteredFile",
                  data: {
                    registeredPath: "docs/lint/second.md",
                    holder: "the repository root",
                    reason: REASON,
                    contentGuarantee: UNCHECKED_CONTENT,
                  },
                },
              ],
            ],
          ]),
        );
      }),
    );
  });

  describe("an owner naming two workspaces", () => {
    const fixture = Effect.gen(function* registrationsOfAnOwnerNamingTwoWorkspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

      yield* filesystem.makeDirectory(paths.join(root, "packages", "alpha"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "package.json"),
        "{}\n",
      );
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "alpha", "README.md"),
        "alpha\n",
      );
      yield* filesystem.makeDirectory(paths.join(root, "packages", "beta"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(root, "packages", "beta", "package.json"),
        "{}\n",
      );
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "README.md", owner: "packages/*", reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("asks the registered path of every workspace it names", () =>
      Effect.gen(function* program() {
        const registrationsOfAnOwnerNamingTwoWorkspaces = yield* fixture;
        expect(registrationsOfAnOwnerNamingTwoWorkspaces).toStrictEqual(
          new Map([
            [
              "packages/beta",
              [
                {
                  workspace: "packages/beta",
                  messageId: "missingRegisteredFile",
                  data: {
                    registeredPath: "packages/beta/README.md",
                    holder: "`packages/beta`",
                    reason: REASON,
                    contentGuarantee: UNCHECKED_CONTENT,
                  },
                },
              ],
            ],
          ]),
        );
      }),
    );
  });

  describe("an owner that names no workspace", () => {
    const fixture = Effect.gen(function* registrationsOfAnOwnerNamingNoWorkspace() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "README.md", owner: "packages/*", reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("is a stale row rather than an absence", () =>
      Effect.gen(function* program() {
        const registrationsOfAnOwnerNamingNoWorkspace = yield* fixture;
        expect(registrationsOfAnOwnerNamingNoWorkspace).toStrictEqual(
          new Map([
            [
              ".",
              [
                {
                  workspace: ".",
                  messageId: "deadOwnerRegistration",
                  data: {
                    registeredPath: "README.md",
                    holder: "`packages/*`",
                    reason: REASON,
                    contentGuarantee: UNCHECKED_CONTENT,
                  },
                },
              ],
            ],
          ]),
        );
      }),
    );
  });

  describe("a row naming content checks", () => {
    const fixture = Effect.gen(function* registrationsOfARowNamingContentChecks() {
      const filesystem = yield* FileSystem.FileSystem;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [
          {
            pattern: "CHANGELOG.md",
            owner: null,
            reason: REASON,
            contentChecks: ["no-lenient-coverage-threshold", "no-empty-section"],
          },
        ],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("names those checks in what the row guarantees", () =>
      Effect.gen(function* program() {
        const registrationsOfARowNamingContentChecks = yield* fixture;
        expect(registrationsOfARowNamingContentChecks).toStrictEqual(
          new Map([
            [
              ".",
              [
                {
                  workspace: ".",
                  messageId: "missingRegisteredFile",
                  data: {
                    registeredPath: "CHANGELOG.md",
                    holder: "the repository root",
                    reason: REASON,
                    contentGuarantee:
                      "What this file holds is read by `no-lenient-coverage-threshold`, `no-empty-section`, so a file that merely exists leaves the row unmet.",
                  },
                },
              ],
            ],
          ]),
        );
      }),
    );
  });

  describe("a file that left after the walk", () => {
    const fixture = Effect.gen(function* registrationsReadAfterTheFileLeft() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

      yield* filesystem.writeFileString(paths.join(root, "CHANGELOG.md"), "released\n");
      unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
      yield* filesystem.remove(paths.join(root, "CHANGELOG.md"));
      return unmetRegistrationsIn({
        repositoryRoot: root,
        entries: [
          {
            pattern: "CHANGELOG.md",
            owner: null,
            reason: "the tag message is copied from it",
            contentChecks: [],
          },
        ],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it.effect("holds nothing left to read", () =>
      Effect.gen(function* program() {
        const registrationsReadAfterTheFileLeft = yield* fixture;
        expect(registrationsReadAfterTheFileLeft).toStrictEqual(
          new Map([
            [
              ".",
              [
                {
                  workspace: ".",
                  messageId: "emptyRegisteredFile",
                  data: {
                    registeredPath: "CHANGELOG.md",
                    holder: "the repository root",
                    reason: "the tag message is copied from it",
                    contentGuarantee: UNCHECKED_CONTENT,
                  },
                },
              ],
            ],
          ]),
        );
      }),
    );
  });

  describe("the same registry read twice", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const rootOfARegistryReadTwice = yield* Effect.gen(function* rootOfARegistryReadTwice() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "unmet-registrations-" });

        yield* filesystem.writeFileString(paths.join(root, "CHANGELOG.md"), "released\n");
        return root;
      });
      const registrationsReadFirstFromTheRegistry = unmetRegistrationsIn({
        repositoryRoot: rootOfARegistryReadTwice,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
      const registrationsReadAgainFromTheSameRegistry = unmetRegistrationsIn({
        repositoryRoot: rootOfARegistryReadTwice,
        entries: [{ pattern: "CHANGELOG.md", owner: null, reason: REASON, contentChecks: [] }],
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
      return {
        rootOfARegistryReadTwice,
        registrationsReadFirstFromTheRegistry,
        registrationsReadAgainFromTheSameRegistry,
      };
    });

    it.effect("is read once and answered from what was read", () =>
      Effect.gen(function* program() {
        const { registrationsReadAgainFromTheSameRegistry, registrationsReadFirstFromTheRegistry } =
          yield* fixtures;
        expect(registrationsReadAgainFromTheSameRegistry).toBe(
          registrationsReadFirstFromTheRegistry,
        );
      }),
    );
  });
});
