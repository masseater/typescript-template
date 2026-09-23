import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultEntryCompositionConfig } from "./config.ts";
import { entryCompositionProblems } from "./entry-composition-problems.ts";
import { writeEntryComposition } from "./write-entry-composition.ts";

const ROOT_PREFIX = "throttle --timeout 1800 -- spool -- ";

const WORKSPACE_PREFIX = "spool -- ";

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

layer(NodeServices.layer)("writeEntryComposition", (it) => {
  describe("a scripts section that does not hold the required entry", () => {
    const writeReportOfTheRunFixture = Effect.gen(function* writeReportOfTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`,
      );
      return yield* writeEntryComposition({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    const manifestTextAfterTheRunFixture = Effect.gen(function* manifestTextAfterTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`,
      );
      yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return yield* filesystem.readFileString(paths.join(repositoryRoot, "package.json"));
    });

    const compositionReportAfterTheRunFixture = Effect.gen(
      function* compositionReportAfterTheRun() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "write-entry-composition-",
        });

        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`,
        );
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return yield* entryCompositionProblems({
          repositoryRoot,
          config: defaultEntryCompositionConfig,
        });
      },
    );

    it.effect("is repaired without any failure", () =>
      Effect.gen(function* program() {
        const writeReportOfTheRun = yield* writeReportOfTheRunFixture;
        expect(writeReportOfTheRun).toStrictEqual({ failures: [] });
      }),
    );

    it.effect("gains the entry as the prefix followed by the placeholder body", () =>
      Effect.gen(function* program() {
        const manifestTextAfterTheRun = yield* manifestTextAfterTheRunFixture;
        expect(manifestTextAfterTheRun).toBe(
          `{\n  "scripts": {\n    "lint": "vp lint",\n    "guard": "${ROOT_PREFIX}exit 0"\n  }\n}\n`,
        );
      }),
    );

    it.effect("has nothing left to report afterwards", () =>
      Effect.gen(function* program() {
        const compositionReportAfterTheRun = yield* compositionReportAfterTheRunFixture;
        expect(compositionReportAfterTheRun).toStrictEqual({
          problems: [],
          failures: [],
          scanned: 1,
        });
      }),
    );
  });

  describe("a manifest that carries no scripts section at all", () => {
    const manifestTextAfterTheRunFixture = Effect.gen(function* manifestTextAfterTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{\n  "name": "x"\n}\n`,
      );
      yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return yield* filesystem.readFileString(paths.join(repositoryRoot, "package.json"));
    });

    it.effect("gains the section around the entry and keeps the surrounding text intact", () =>
      Effect.gen(function* program() {
        const manifestTextAfterTheRun = yield* manifestTextAfterTheRunFixture;
        expect(manifestTextAfterTheRun).toBe(
          `{\n  "name": "x",\n  "scripts": {\n    "guard": "${ROOT_PREFIX}exit 0"\n  }\n}\n`,
        );
      }),
    );
  });

  describe("an entry that carries only part of the wrapper column", () => {
    const manifestTextAfterTheRunFixture = Effect.gen(function* manifestTextAfterTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "spool -- vp check" } }`,
      );
      yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return yield* filesystem.readFileString(paths.join(repositoryRoot, "package.json"));
    });

    it.effect("gains only the missing part of the column", () =>
      Effect.gen(function* program() {
        const manifestTextAfterTheRun = yield* manifestTextAfterTheRunFixture;
        expect(manifestTextAfterTheRun).toBe(
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        );
      }),
    );
  });

  describe("an entry whose column element carries different options", () => {
    const manifestTextAfterTheRunFixture = Effect.gen(function* manifestTextAfterTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "throttle --timeout 900 -- spool -- vp check" } }`,
      );
      yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return yield* filesystem.readFileString(paths.join(repositoryRoot, "package.json"));
    });

    it.effect("loses that element by name and gains the required column", () =>
      Effect.gen(function* program() {
        const manifestTextAfterTheRun = yield* manifestTextAfterTheRunFixture;
        expect(manifestTextAfterTheRun).toBe(
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        );
      }),
    );
  });

  describe("an entry whose head is not a wrapper but holds the separator", () => {
    const manifestTextAfterTheRunFixture = Effect.gen(function* manifestTextAfterTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "vp exec tool -- --flag" } }`,
      );
      yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return yield* filesystem.readFileString(paths.join(repositoryRoot, "package.json"));
    });

    it.effect("keeps that head and only gains the prefix in front of it", () =>
      Effect.gen(function* program() {
        const manifestTextAfterTheRun = yield* manifestTextAfterTheRunFixture;
        expect(manifestTextAfterTheRun).toBe(
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp exec tool -- --flag" } }`,
        );
      }),
    );
  });

  describe("an entry whose column is complete but ordered the other way", () => {
    const manifestTextAfterTheRunFixture = Effect.gen(function* manifestTextAfterTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "spool -- throttle --timeout 1800 -- vp check" } }`,
      );
      yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return yield* filesystem.readFileString(paths.join(repositoryRoot, "package.json"));
    });

    it.effect("is normalized to the required order", () =>
      Effect.gen(function* program() {
        const manifestTextAfterTheRun = yield* manifestTextAfterTheRunFixture;
        expect(manifestTextAfterTheRun).toBe(
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        );
      }),
    );
  });

  describe("a repository the first run already repaired", () => {
    const writeReportOfTheSecondRunFixture = Effect.gen(function* writeReportOfTheSecondRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "web", "package.json"),
        `{ "scripts": { "test": "vp test" } }`,
      );
      yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return yield* writeEntryComposition({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    const rootManifestTextAfterTheFirstRunFixture = Effect.gen(
      function* rootManifestTextAfterTheFirstRun() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "write-entry-composition-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_DEFINITION,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
        );
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return yield* filesystem.readFileString(paths.join(repositoryRoot, "package.json"));
      },
    );

    const rootManifestTextAfterTheSecondRunFixture = Effect.gen(
      function* rootManifestTextAfterTheSecondRun() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "write-entry-composition-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_DEFINITION,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
        );
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return yield* filesystem.readFileString(paths.join(repositoryRoot, "package.json"));
      },
    );

    const workspaceManifestTextAfterTheFirstRunFixture = Effect.gen(
      function* workspaceManifestTextAfterTheFirstRun() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "write-entry-composition-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_DEFINITION,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
        );
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return yield* filesystem.readFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
        );
      },
    );

    const workspaceManifestTextAfterTheSecondRunFixture = Effect.gen(
      function* workspaceManifestTextAfterTheSecondRun() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "write-entry-composition-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_DEFINITION,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
        );
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return yield* filesystem.readFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
        );
      },
    );

    const compositionReportAfterTheSecondRunFixture = Effect.gen(
      function* compositionReportAfterTheSecondRun() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "write-entry-composition-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{\n  "scripts": {\n    "guard": "spool -- vp check"\n  }\n}\n`,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_DEFINITION,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test" } }`,
        );
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return yield* entryCompositionProblems({
          repositoryRoot,
          config: defaultEntryCompositionConfig,
        });
      },
    );

    it.effect("runs a second time without any failure", () =>
      Effect.gen(function* program() {
        const writeReportOfTheSecondRun = yield* writeReportOfTheSecondRunFixture;
        expect(writeReportOfTheSecondRun).toStrictEqual({ failures: [] });
      }),
    );

    it.effect("leaves the root manifest carrying the root column after the first run", () =>
      Effect.gen(function* program() {
        const rootManifestTextAfterTheFirstRun = yield* rootManifestTextAfterTheFirstRunFixture;
        expect(rootManifestTextAfterTheFirstRun).toBe(
          `{\n  "scripts": {\n    "guard": "${ROOT_PREFIX}vp check"\n  }\n}\n`,
        );
      }),
    );

    it.effect("keeps the root manifest exactly as the first run left it", () =>
      Effect.gen(function* program() {
        const rootManifestTextAfterTheSecondRun = yield* rootManifestTextAfterTheSecondRunFixture;
        expect(rootManifestTextAfterTheSecondRun).toBe(
          `{\n  "scripts": {\n    "guard": "${ROOT_PREFIX}vp check"\n  }\n}\n`,
        );
      }),
    );

    it.effect(
      "leaves the workspace manifest carrying the workspace prefix after the first run",
      () =>
        Effect.gen(function* program() {
          const workspaceManifestTextAfterTheFirstRun =
            yield* workspaceManifestTextAfterTheFirstRunFixture;
          expect(workspaceManifestTextAfterTheFirstRun).toBe(
            `{ "scripts": { "test": "${WORKSPACE_PREFIX}vp test" } }`,
          );
        }),
    );

    it.effect("keeps the workspace manifest exactly as the first run left it", () =>
      Effect.gen(function* program() {
        const workspaceManifestTextAfterTheSecondRun =
          yield* workspaceManifestTextAfterTheSecondRunFixture;
        expect(workspaceManifestTextAfterTheSecondRun).toBe(
          `{ "scripts": { "test": "${WORKSPACE_PREFIX}vp test" } }`,
        );
      }),
    );

    it.effect("has nothing left to report afterwards", () =>
      Effect.gen(function* program() {
        const compositionReportAfterTheSecondRun = yield* compositionReportAfterTheSecondRunFixture;
        expect(compositionReportAfterTheSecondRun).toStrictEqual({
          problems: [],
          failures: [],
          scanned: 2,
        });
      }),
    );
  });

  describe("a workspace manifest that declares the guarded names", () => {
    const workspaceManifestTextAfterTheRunFixture = Effect.gen(
      function* workspaceManifestTextAfterTheRun() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "write-entry-composition-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_DEFINITION,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "vp test", "check": "${WORKSPACE_PREFIX}vp check" } }`,
        );
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return yield* filesystem.readFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
        );
      },
    );

    it.effect("carries the workspace prefix on every declared entry", () =>
      Effect.gen(function* program() {
        const workspaceManifestTextAfterTheRun = yield* workspaceManifestTextAfterTheRunFixture;
        expect(workspaceManifestTextAfterTheRun).toBe(
          `{ "scripts": { "test": "${WORKSPACE_PREFIX}vp test", "check": "${WORKSPACE_PREFIX}vp check" } }`,
        );
      }),
    );
  });

  describe("a workspace entry headed by a wrapper of another layer", () => {
    const writeReportOfTheRunFixture = Effect.gen(function* writeReportOfTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages", "web", "package.json"),
        `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
      );
      return yield* writeEntryComposition({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    const workspaceManifestTextAfterTheRunFixture = Effect.gen(
      function* workspaceManifestTextAfterTheRun() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "write-entry-composition-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_DEFINITION,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
        );
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return yield* filesystem.readFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
        );
      },
    );

    const compositionReportAfterTheRunFixture = Effect.gen(
      function* compositionReportAfterTheRun() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "write-entry-composition-",
        });

        yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages", "web"), {
          recursive: true,
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "pnpm-workspace.yaml"),
          WORKSPACE_DEFINITION,
        );
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "packages", "web", "package.json"),
          `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
        );
        yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
        return yield* entryCompositionProblems({
          repositoryRoot,
          config: defaultEntryCompositionConfig,
        });
      },
    );

    it.effect("does not turn into a failure of the run", () =>
      Effect.gen(function* program() {
        const writeReportOfTheRun = yield* writeReportOfTheRunFixture;
        expect(writeReportOfTheRun).toStrictEqual({ failures: [] });
      }),
    );

    it.effect("is left untouched", () =>
      Effect.gen(function* program() {
        const workspaceManifestTextAfterTheRun = yield* workspaceManifestTextAfterTheRunFixture;
        expect(workspaceManifestTextAfterTheRun).toBe(
          `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
        );
      }),
    );

    it.effect("keeps its report standing afterwards", () =>
      Effect.gen(function* program() {
        const compositionReportAfterTheRun = yield* compositionReportAfterTheRunFixture;
        expect(compositionReportAfterTheRun).toStrictEqual({
          problems: [
            {
              file: "packages/web/package.json",
              line: 1,
              message: `The "test" script must not start with "throttle ". Rewrite the value to start with the required prefix "${WORKSPACE_PREFIX}".`,
            },
          ],
          failures: [],
          scanned: 2,
        });
      }),
    );
  });

  describe("a repository that already satisfies the composition", () => {
    const writeReportOfTheRunFixture = Effect.gen(function* writeReportOfTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      return yield* writeEntryComposition({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    const manifestTextAfterTheRunFixture = Effect.gen(function* manifestTextAfterTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return yield* filesystem.readFileString(paths.join(repositoryRoot, "package.json"));
    });

    it.effect("runs without any failure", () =>
      Effect.gen(function* program() {
        const writeReportOfTheRun = yield* writeReportOfTheRunFixture;
        expect(writeReportOfTheRun).toStrictEqual({ failures: [] });
      }),
    );

    it.effect("is left exactly as it stood", () =>
      Effect.gen(function* program() {
        const manifestTextAfterTheRun = yield* manifestTextAfterTheRunFixture;
        expect(manifestTextAfterTheRun).toBe(
          `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
        );
      }),
    );
  });

  describe("a manifest that needs a repair it cannot receive", () => {
    const unwritableRunFixture = Effect.gen(function* unwritableRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-unwritable-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "vp check" } }`,
      );
      yield* filesystem.chmod(paths.join(repositoryRoot, "package.json"), 0o444);
      const writeReport = yield* writeEntryComposition({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
      return { repositoryRoot, writeReport };
    });

    it.effect("hands back the write failure instead of pretending the repair happened", () =>
      Effect.gen(function* program() {
        const paths = yield* Path.Path;
        const { repositoryRoot, writeReport } = yield* unwritableRunFixture;
        expect(writeReport).toStrictEqual({
          failures: [
            `package.json could not be rewritten: EACCES: permission denied, open '${paths.join(repositoryRoot, "package.json")}'`,
          ],
        });
      }),
    );
  });

  describe("a manifest the listing could not read", () => {
    const writeReportOfTheRunFixture = Effect.gen(function* writeReportOfTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(paths.join(repositoryRoot, "package.json"), "{ oops");
      return yield* writeEntryComposition({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    const manifestTextAfterTheRunFixture = Effect.gen(function* manifestTextAfterTheRun() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "write-entry-composition-",
      });

      yield* filesystem.writeFileString(paths.join(repositoryRoot, "package.json"), "{ oops");
      yield* writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig });
      return yield* filesystem.readFileString(paths.join(repositoryRoot, "package.json"));
    });

    it.effect("passes the listing failure through", () =>
      Effect.gen(function* program() {
        const writeReportOfTheRun = yield* writeReportOfTheRunFixture;
        expect(writeReportOfTheRun).toStrictEqual({
          failures: [
            "package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
          ],
        });
      }),
    );

    it.effect("is left unwritten", () =>
      Effect.gen(function* program() {
        const manifestTextAfterTheRun = yield* manifestTextAfterTheRunFixture;
        expect(manifestTextAfterTheRun).toBe("{ oops");
      }),
    );
  });
});
