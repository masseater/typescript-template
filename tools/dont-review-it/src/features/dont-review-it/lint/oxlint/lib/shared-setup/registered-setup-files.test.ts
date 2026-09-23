import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import {
  UNSCANNED_DIRECTORY_NAMES,
  worktreeFilePathsUnder,
} from "../repository-scan/worktree-files.ts";
import { isRunnerConfigurationFile, sharedSetupFilesUnder } from "./registered-setup-files.ts";

describe("isRunnerConfigurationFile", () => {
  describe("a module carrying the name the toolchain gives the runner configuration", () => {
    const it = test.extend("runnerConfigurationReadingOfTheConfigurationName", () =>
      isRunnerConfigurationFile("packages/held/vite.config.ts"));

    it("reads it as the runner configuration", ({
      runnerConfigurationReadingOfTheConfigurationName,
    }) => {
      expect(runnerConfigurationReadingOfTheConfigurationName).toBe(true);
    });
  });

  describe("a module that is not the runner configuration", () => {
    const it = test.extend("runnerConfigurationReadingOfAModuleThatIsNotTheConfiguration", () =>
      isRunnerConfigurationFile("packages/held/vitest.setup.ts"));

    it("leaves it alone", ({ runnerConfigurationReadingOfAModuleThatIsNotTheConfiguration }) => {
      expect(runnerConfigurationReadingOfAModuleThatIsNotTheConfiguration).toBe(false);
    });
  });
});

layer(NodeServices.layer)("sharedSetupFilesUnder", (it) => {
  describe("a runner block that registers setup modules", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupTheRunnerRegistersAndEverythingItReaches = yield* Effect.gen(
        function* setupTheRunnerRegistersAndEverythingItReaches() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "registered");
          yield* filesystem.makeDirectory(paths.join(root, "setup"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/shared.setup.ts"], globalSetup: "setup/global.ts" } });\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/shared.setup.ts"),
            'import "./reached.ts";\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/reached.ts"),
            "export const seeded = 1;\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/global.ts"),
            "export const started = 1;\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/unreached.ts"),
            "export const idle = 1;\n",
          );
          return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
        },
      );
      return { fixtureRoot, setupTheRunnerRegistersAndEverythingItReaches };
    });

    it.effect("takes every module the runner registers as setup and everything they reach", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { setupTheRunnerRegistersAndEverythingItReaches, fixtureRoot } = yield* fixtures;
        expect(setupTheRunnerRegistersAndEverythingItReaches).toStrictEqual(
          new Set([
            paths.join(fixtureRoot, "registered", "setup/global.ts"),
            paths.join(fixtureRoot, "registered", "setup/reached.ts"),
            paths.join(fixtureRoot, "registered", "setup/shared.setup.ts"),
          ]),
        );
      }),
    );
  });

  describe("a project block standing under the runner block", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupAProjectBlockRegistersUnderTheRunnerBlock = yield* Effect.gen(
        function* setupAProjectBlockRegistersUnderTheRunnerBlock() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "projects");
          yield* filesystem.makeDirectory(paths.join(root, "setup"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { projects: [{ test: { setupFiles: "./setup/project.ts" } }, { root: "./packages/held" }, "./packages/held"] } });\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/project.ts"),
            "export const seeded = 1;\n",
          );
          return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
        },
      );
      return { fixtureRoot, setupAProjectBlockRegistersUnderTheRunnerBlock };
    });

    it.effect("takes the setup that project block registers", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { setupAProjectBlockRegistersUnderTheRunnerBlock, fixtureRoot } = yield* fixtures;
        expect(setupAProjectBlockRegistersUnderTheRunnerBlock).toStrictEqual(
          new Set([paths.join(fixtureRoot, "projects", "setup/project.ts")]),
        );
      }),
    );
  });

  describe("setup modules that reach each other in a cycle", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupReachedThroughACycle = yield* Effect.gen(function* setupReachedThroughACycle() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "cycle");
        yield* filesystem.makeDirectory(paths.join(root, "setup"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(root, "pnpm-workspace.yaml"),
          "packages:\n  - packages/*\n",
        );
        yield* filesystem.writeFileString(
          paths.join(root, "package.json"),
          '{ "name": "@fixture/root" }\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "vite.config.ts"),
          'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/first.ts"] } });\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "setup/first.ts"),
          'import "./second.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "setup/second.ts"),
          'import "./first.ts";\n',
        );
        return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
      });
      return { fixtureRoot, setupReachedThroughACycle };
    });

    it.effect("stops at the module it has already taken", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { setupReachedThroughACycle, fixtureRoot } = yield* fixtures;
        expect(setupReachedThroughACycle).toStrictEqual(
          new Set([
            paths.join(fixtureRoot, "cycle", "setup/first.ts"),
            paths.join(fixtureRoot, "cycle", "setup/second.ts"),
          ]),
        );
      }),
    );
  });

  describe("a setup module that reaches a spec file", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupThatReachesASpecFile = yield* Effect.gen(function* setupThatReachesASpecFile() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const root = paths.join(fixtureRoot, "reaches-spec");
        yield* filesystem.makeDirectory(paths.join(root, "setup"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(root, "pnpm-workspace.yaml"),
          "packages:\n  - packages/*\n",
        );
        yield* filesystem.writeFileString(
          paths.join(root, "package.json"),
          '{ "name": "@fixture/root" }\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "vite.config.ts"),
          'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["setup/shared.ts"] } });\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "setup/shared.ts"),
          'import "./held.test.ts";\n',
        );
        yield* filesystem.writeFileString(
          paths.join(root, "setup/held.test.ts"),
          "export const asserted = 1;\n",
        );
        return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
      });
      return { fixtureRoot, setupThatReachesASpecFile };
    });

    it.effect("leaves that spec file out of the set", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { setupThatReachesASpecFile, fixtureRoot } = yield* fixtures;
        expect(setupThatReachesASpecFile).toStrictEqual(
          new Set([paths.join(fixtureRoot, "reaches-spec", "setup/shared.ts")]),
        );
      }),
    );
  });

  describe("a runner block that registers no setup", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupReadOutOfARunnerBlockThatRegistersNone = yield* Effect.gen(
        function* setupReadOutOfARunnerBlockThatRegistersNone() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "bare");
          yield* filesystem.makeDirectory(paths.join(root, "setup"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { coverage: { thresholds: { 100: true } }, projects: "./packages/held" } });\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/idle.ts"),
            "export const idle = 1;\n",
          );
          return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
        },
      );
      return { fixtureRoot, setupReadOutOfARunnerBlockThatRegistersNone };
    });

    it.effect("reads no setup out of it", () =>
      Effect.gen(function* program() {
        const { setupReadOutOfARunnerBlockThatRegistersNone } = yield* fixtures;
        expect(setupReadOutOfARunnerBlockThatRegistersNone).toStrictEqual(new Set());
      }),
    );
  });

  describe("a setup module that reaches outside the worktree", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupThatReachesOutsideTheWorktree = yield* Effect.gen(
        function* setupThatReachesOutsideTheWorktree() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "escapes");
          yield* filesystem.makeDirectory(paths.join(root, "setup"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(fixtureRoot, "outside.ts"),
            "export const held = 1;\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/shared.ts"] } });\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/shared.ts"),
            'import "../../outside.ts";\n',
          );
          return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
        },
      );
      return { fixtureRoot, setupThatReachesOutsideTheWorktree };
    });

    it.effect("leaves the module beyond the worktree out of the set", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { setupThatReachesOutsideTheWorktree, fixtureRoot } = yield* fixtures;
        expect(setupThatReachesOutsideTheWorktree).toStrictEqual(
          new Set([paths.join(fixtureRoot, "escapes", "setup/shared.ts")]),
        );
      }),
    );
  });

  describe("an entry that resolves to no single path", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupReadOutOfAnEntryThatResolvesToNoSinglePath = yield* Effect.gen(
        function* setupReadOutOfAnEntryThatResolvesToNoSinglePath() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "unreadable");
          yield* filesystem.makeDirectory(root, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: [chosenSetup, "./setup/missing.ts"], globalSetup: { held: 1 } } });\n',
          );
          return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
        },
      );
      return { fixtureRoot, setupReadOutOfAnEntryThatResolvesToNoSinglePath };
    });

    it.effect("reads no setup out of it", () =>
      Effect.gen(function* program() {
        const { setupReadOutOfAnEntryThatResolvesToNoSinglePath } = yield* fixtures;
        expect(setupReadOutOfAnEntryThatResolvesToNoSinglePath).toStrictEqual(new Set());
      }),
    );
  });

  describe("a configuration that left the worktree after the scan", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupReadAfterTheConfigurationLeftTheWorktree = yield* Effect.gen(
        function* setupReadAfterTheConfigurationLeftTheWorktree() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "vanished");
          yield* filesystem.makeDirectory(paths.join(root, "setup"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/shared.ts"] } });\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/shared.ts"),
            "export const seeded = 1;\n",
          );
          worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
          yield* filesystem.remove(paths.join(root, "vite.config.ts"));
          return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
        },
      );
      return { fixtureRoot, setupReadAfterTheConfigurationLeftTheWorktree };
    });

    it.effect("reads no setup out of it", () =>
      Effect.gen(function* program() {
        const { setupReadAfterTheConfigurationLeftTheWorktree } = yield* fixtures;
        expect(setupReadAfterTheConfigurationLeftTheWorktree).toStrictEqual(new Set());
      }),
    );
  });

  describe("a configuration that exports no runner block", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupReadOutOfAConfigurationThatExportsNoRunnerBlock = yield* Effect.gen(
        function* setupReadOutOfAConfigurationThatExportsNoRunnerBlock() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "no-export");
          yield* filesystem.makeDirectory(root, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            "export const held = { test: { setupFiles: [] } };\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.mts"),
            "export default 1;\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.cts"),
            "export default defineConfig({ lint: { rules: {} } });\n",
          );
          return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
        },
      );
      return { fixtureRoot, setupReadOutOfAConfigurationThatExportsNoRunnerBlock };
    });

    it.effect("reads no setup out of it", () =>
      Effect.gen(function* program() {
        const { setupReadOutOfAConfigurationThatExportsNoRunnerBlock } = yield* fixtures;
        expect(setupReadOutOfAConfigurationThatExportsNoRunnerBlock).toStrictEqual(new Set());
      }),
    );
  });

  describe("a configuration whose factory takes no argument", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument = yield* Effect.gen(
        function* setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "empty-call");
          yield* filesystem.makeDirectory(root, { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            "export default defineConfig();\n",
          );
          return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
        },
      );
      return { fixtureRoot, setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument };
    });

    it.effect("reads no setup out of it", () =>
      Effect.gen(function* program() {
        const { setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument } = yield* fixtures;
        expect(setupReadOutOfAConfigurationWhoseFactoryTakesNoArgument).toStrictEqual(new Set());
      }),
    );
  });

  describe("a runner block whose keys are spelled out as strings", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupReadOutOfAKeySpelledOutAsAString = yield* Effect.gen(
        function* setupReadOutOfAKeySpelledOutAsAString() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "spelled-keys");
          yield* filesystem.makeDirectory(paths.join(root, "setup"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { "setupFiles": ["./setup/spelled.ts"], [chosenKey]: "./setup/computed.ts", 0: "./setup/numbered.ts", ...held } });\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/spelled.ts"),
            "export const seeded = 1;\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/computed.ts"),
            "export const idle = 1;\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/numbered.ts"),
            "export const idle = 1;\n",
          );
          return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
        },
      );
      return { fixtureRoot, setupReadOutOfAKeySpelledOutAsAString };
    });

    it.effect("reads the key spelled out as a string and no other", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { setupReadOutOfAKeySpelledOutAsAString, fixtureRoot } = yield* fixtures;
        expect(setupReadOutOfAKeySpelledOutAsAString).toStrictEqual(
          new Set([paths.join(fixtureRoot, "spelled-keys", "setup/spelled.ts")]),
        );
      }),
    );
  });

  describe("an option naming the setup files itself", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupNamedByTheDeclaredEntriesOption = yield* Effect.gen(
        function* setupNamedByTheDeclaredEntriesOption() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "declared");
          yield* filesystem.makeDirectory(paths.join(root, "setup"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/registered.ts"] } });\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/registered.ts"),
            "export const seeded = 1;\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/declared.ts"),
            "export const seeded = 2;\n",
          );
          return sharedSetupFilesUnder({
            workspaceRoot: root,
            declaredEntries: ["setup/declared.ts"],
          });
        },
      );
      return { fixtureRoot, setupNamedByTheDeclaredEntriesOption };
    });

    it.effect("takes the files it names in place of the ones the runner registers", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { setupNamedByTheDeclaredEntriesOption, fixtureRoot } = yield* fixtures;
        expect(setupNamedByTheDeclaredEntriesOption).toStrictEqual(
          new Set([paths.join(fixtureRoot, "declared", "setup/declared.ts")]),
        );
      }),
    );
  });

  describe("a configuration already read once before it left the worktree", () => {
    const fixtures = Effect.gen(function* fixtures() {
      const filesystem = yield* FileSystem.FileSystem;
      const fixtureRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "dont-review-it-registered-setup-files-",
      });
      const setupHandedBackAfterTheConfigurationWasReadOnceAlready = yield* Effect.gen(
        function* setupHandedBackAfterTheConfigurationWasReadOnceAlready() {
          const filesystem = yield* FileSystem.FileSystem;
          const paths = yield* Path.Path;
          const root = paths.join(fixtureRoot, "remembered");
          yield* filesystem.makeDirectory(paths.join(root, "setup"), { recursive: true });
          yield* filesystem.writeFileString(
            paths.join(root, "pnpm-workspace.yaml"),
            "packages:\n  - packages/*\n",
          );
          yield* filesystem.writeFileString(
            paths.join(root, "package.json"),
            '{ "name": "@fixture/root" }\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "vite.config.ts"),
            'import { defineConfig } from "vite-plus";\n\nexport default defineConfig({ test: { setupFiles: ["./setup/shared.ts"] } });\n',
          );
          yield* filesystem.writeFileString(
            paths.join(root, "setup/shared.ts"),
            "export const seeded = 1;\n",
          );
          sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
          yield* filesystem.remove(paths.join(root, "vite.config.ts"));
          return sharedSetupFilesUnder({ workspaceRoot: root, declaredEntries: [] });
        },
      );
      return { fixtureRoot, setupHandedBackAfterTheConfigurationWasReadOnceAlready };
    });

    it.effect("hands back the set it read the first time", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { setupHandedBackAfterTheConfigurationWasReadOnceAlready, fixtureRoot } =
          yield* fixtures;
        expect(setupHandedBackAfterTheConfigurationWasReadOnceAlready).toStrictEqual(
          new Set([paths.join(fixtureRoot, "remembered", "setup/shared.ts")]),
        );
      }),
    );
  });
});
