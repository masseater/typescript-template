import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultEntryCompositionConfig } from "./config.ts";
import { entryCompositionProblems } from "./entry-composition-problems.ts";

const ROOT_PREFIX = "throttle --timeout 1800 -- spool -- ";

const WORKSPACE_PREFIX = "spool -- ";

const WORKSPACE_DEFINITION = "packages:\n  - packages/*\n";

layer(NodeServices.layer)("entryCompositionProblems", (it) => {
  describe("a repository whose entries all carry their layer prefix", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages/web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages/web/package.json"),
        `{ "scripts": { "test": "${WORKSPACE_PREFIX}vp test", "build": "${WORKSPACE_PREFIX}vp pack" } }`,
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("says nothing about either layer", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], failures: [], scanned: 2 });
      }),
    );
  });

  describe("a required entry missing from an existing scripts section", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{\n  "name": "x",\n  "scripts": {\n    "lint": "vp lint"\n  }\n}\n`,
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("names the entry at the line the scripts section opens on", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "package.json",
              line: 3,
              message: `The required "guard" script must not be missing. Add "guard" with a value that starts with "${ROOT_PREFIX}".`,
            },
          ],
          failures: [],
          scanned: 1,
        });
      }),
    );
  });

  describe("a manifest holding no scripts section at all", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{\n  "name": "x"\n}\n`,
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("reports the missing section apart from a missing entry and points at no line", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "package.json",
              line: null,
              message: `The scripts section holding the required "guard" entry must not be missing. Add a scripts section whose "guard" value starts with "${ROOT_PREFIX}".`,
            },
          ],
          failures: [],
          scanned: 1,
        });
      }),
    );
  });

  describe("a required entry whose head is not the required prefix", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{\n  "name": "x",\n  "scripts": {\n    "guard": "vp check"\n  }\n}\n`,
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("states the actual head beside the required prefix", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "package.json",
              line: 4,
              message: `The "guard" script must not start with "vp check". Rewrite the value to start with the required prefix "${ROOT_PREFIX}".`,
            },
          ],
          failures: [],
          scanned: 1,
        });
      }),
    );
  });

  describe("a value whose wrapper column is complete but reversed", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "spool -- throttle --timeout 1800 -- vp check" } }`,
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("reads the reversed column as the head it must not start with", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "package.json",
              line: 1,
              message: `The "guard" script must not start with "spool -- throttle --timeout 1800 -- ". Rewrite the value to start with the required prefix "${ROOT_PREFIX}".`,
            },
          ],
          failures: [],
          scanned: 1,
        });
      }),
    );
  });

  describe("a workspace manifest that declares none of the guarded names", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages/web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages/web/package.json"),
        `{ "scripts": { "lint": "vp lint" } }`,
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("says nothing about the names it never declared", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], failures: [], scanned: 2 });
      }),
    );
  });

  describe("a declared workspace entry that lacks the workspace prefix", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages/web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages/web/package.json"),
        `{ "scripts": { "check": "vp check" } }`,
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("asks for the workspace prefix rather than the root one", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "packages/web/package.json",
              line: 1,
              message: `The "check" script must not start with "vp check". Rewrite the value to start with the required prefix "${WORKSPACE_PREFIX}".`,
            },
          ],
          failures: [],
          scanned: 2,
        });
      }),
    );
  });

  describe("a workspace entry that puts the upper wrapper at its head", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages/web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages/web/package.json"),
        `{ "scripts": { "test": "throttle -- spool -- vp test" } }`,
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect(
      "reports that workspace manifest for a head the workspace layer never asked for",
      () =>
        Effect.gen(function* program() {
          const report = yield* reportFixture;
          expect(report).toStrictEqual({
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

  describe("a script whose value is not a string", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": 1 } }`,
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("reads it as an empty head", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "package.json",
              line: 1,
              message: `The "guard" script must not start with "". Rewrite the value to start with the required prefix "${ROOT_PREFIX}".`,
            },
          ],
          failures: [],
          scanned: 1,
        });
      }),
    );
  });

  describe("a repository holding no root manifest", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages/web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages/web/package.json"),
        `{ "scripts": { "check": "vp check" } }`,
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect(
      "leaves the absent manifest out of the enumeration and still walks the workspaces",
      () =>
        Effect.gen(function* program() {
          const report = yield* reportFixture;
          expect(report).toStrictEqual({
            problems: [
              {
                file: "packages/web/package.json",
                line: 1,
                message: `The "check" script must not start with "vp check". Rewrite the value to start with the required prefix "${WORKSPACE_PREFIX}".`,
              },
            ],
            failures: [],
            scanned: 1,
          });
        }),
    );
  });

  describe("definitions written outside the manifests and patterns matching nothing", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages:\n  - packages/*\n  - docs\n  - '!ignored'\n  - .\n  - 1\n",
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "scripts"), { recursive: true });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "scripts/heavy.sh"),
        "vp run -r test --coverage\n",
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages/empty"), {
        recursive: true,
      });
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("keeps both of them out of its sight", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], failures: [], scanned: 1 });
      }),
    );
  });

  describe("a root manifest that does not parse", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(paths.join(repositoryRoot, "package.json"), "{ oops");
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("becomes a failure of the check itself rather than a problem", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [],
          failures: [
            "package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
          ],
          scanned: 0,
        });
      }),
    );
  });

  describe("a root manifest that is empty", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(paths.join(repositoryRoot, "package.json"), "");
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("becomes a failure of the check itself", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [],
          failures: [
            "package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
          ],
          scanned: 0,
        });
      }),
    );
  });

  describe("a root manifest that parses into something other than an object", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(paths.join(repositoryRoot, "package.json"), "[]");
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("becomes a failure of the check itself", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [],
          failures: [
            "package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
          ],
          scanned: 0,
        });
      }),
    );
  });

  describe("a root manifest that exists but cannot be read", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "package.json"));
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("becomes a failure of the check itself", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [],
          failures: [
            "package.json exists but cannot be read, so the entry composition check did not run.",
          ],
          scanned: 0,
        });
      }),
    );
  });

  describe("a workspace manifest that does not parse", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "vp check" } }`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        WORKSPACE_DEFINITION,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "packages/web"), {
        recursive: true,
      });
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "packages/web/package.json"),
        "{ oops",
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("becomes a failure without silencing the layer that did parse", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [
            {
              file: "package.json",
              line: 1,
              message: `The "guard" script must not start with "vp check". Rewrite the value to start with the required prefix "${ROOT_PREFIX}".`,
            },
          ],
          failures: [
            "packages/web/package.json exists but does not parse as a JSON object, so the entry composition check did not run.",
          ],
          scanned: 1,
        });
      }),
    );
  });

  describe("a workspace definition that does not parse as YAML", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "packages: [\n",
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("becomes a failure of the check itself", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [],
          failures: [
            "pnpm-workspace.yaml exists but does not parse as YAML, so the entry composition check did not run.",
          ],
          scanned: 1,
        });
      }),
    );
  });

  describe("a workspace definition that cannot be read", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      yield* filesystem.makeDirectory(paths.join(repositoryRoot, "pnpm-workspace.yaml"));
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("becomes a failure of the check itself", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({
          problems: [],
          failures: [
            "pnpm-workspace.yaml exists but cannot be read, so the entry composition check did not run.",
          ],
          scanned: 1,
        });
      }),
    );
  });

  describe("a workspace definition carrying no patterns", () => {
    const reportFixture = Effect.gen(function* report() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "entry-composition-problems-",
      });

      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "package.json"),
        `{ "scripts": { "guard": "${ROOT_PREFIX}vp check" } }`,
      );
      yield* filesystem.writeFileString(
        paths.join(repositoryRoot, "pnpm-workspace.yaml"),
        "catalog: {}\n",
      );
      return yield* entryCompositionProblems({
        repositoryRoot,
        config: defaultEntryCompositionConfig,
      });
    });

    it.effect("reads it as an empty workspace layer", () =>
      Effect.gen(function* program() {
        const report = yield* reportFixture;
        expect(report).toStrictEqual({ problems: [], failures: [], scanned: 1 });
      }),
    );
  });
});
