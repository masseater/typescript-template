import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { runPresetAdoptionChecks } from "./run-preset-adoption-checks.ts";

const TWO_WORKSPACES = {
  "package.json": `{ "name": "root" }`,
  "packages/left/package.json": `{ "name": "left" }`,
  "packages/right/package.json": `{ "name": "right" }`,
};

const THREE_WORKSPACES = {
  ...TWO_WORKSPACES,
  "packages/middle/package.json": `{ "name": "middle" }`,
};

layer(NodeServices.layer)("runPresetAdoptionChecks", (it) => {
  describe("a configuration switching off a preset rule that no bundle carries", () => {
    const reportOverARuleNoBundleCarriesFixture = Effect.gen(
      function* reportOverARuleNoBundleCarries() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "preset-adoption-",
        });
        for (const [relativePath, writtenSource] of Object.entries({
          ...TWO_WORKSPACES,
          "vite.config.ts": `export default defineConfig({
  lint: { rules: { "dont-review-it/no-such-rule--do-something": "off" } },
});`,
        })) {
          const writtenPath = paths.join(repositoryRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
          yield* filesystem.writeFileString(writtenPath, writtenSource);
        }
        return yield* runPresetAdoptionChecks({
          repositoryRoot,
          config: defaultPresetAdoptionConfig,
        });
      },
    );

    it.effect("names the workspaces it stops reaching, as it does for any preset rule", () =>
      Effect.gen(function* program() {
        const reportOverARuleNoBundleCarries = yield* reportOverARuleNoBundleCarriesFixture;
        expect(reportOverARuleNoBundleCarries).toStrictEqual({
          warnings: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The lint configuration must not leave dont-review-it/no-such-rule--do-something switched off for packages/left. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
            },
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The lint configuration must not leave dont-review-it/no-such-rule--do-something switched off for packages/right. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
            },
          ],
          scanned: 2,
          configMissing: false,
        });
      }),
    );
  });

  describe("a configuration switching off a rule of a bundle it never names", () => {
    const reportOverAnUnadoptedBundleFixture = Effect.gen(function* reportOverAnUnadoptedBundle() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "preset-adoption-",
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `export default defineConfig({
  lint: dontReviewItPreset.lint({
    bundles: ["testing"],
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
  }),
});`,
      })) {
        const writtenPath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
        yield* filesystem.writeFileString(writtenPath, writtenSource);
      }
      return yield* runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it.effect("says the override stops nothing", () =>
      Effect.gen(function* program() {
        const reportOverAnUnadoptedBundle = yield* reportOverAnUnadoptedBundleFixture;
        expect(reportOverAnUnadoptedBundle).toStrictEqual({
          warnings: [
            {
              file: "vite.config.ts",
              line: 4,
              message:
                "The lint configuration must not switch dont-review-it/no-reassign--use-spread-or-iife off while it does not carry the mutation-and-failure bundle, because the override stops nothing. Delete the override, or name that bundle where the preset is called.",
            },
          ],
          scanned: 2,
          configMissing: false,
        });
      }),
    );
  });

  describe("a configuration that switches nothing off", () => {
    const reportOverAConfigurationSwitchingNothingOffFixture = Effect.gen(
      function* reportOverAConfigurationSwitchingNothingOff() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "preset-adoption-",
        });
        for (const [relativePath, writtenSource] of Object.entries({
          ...TWO_WORKSPACES,
          "vite.config.ts": `export default defineConfig({ lint: { rules: {} } });`,
        })) {
          const writtenPath = paths.join(repositoryRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
          yield* filesystem.writeFileString(writtenPath, writtenSource);
        }
        return yield* runPresetAdoptionChecks({
          repositoryRoot,
          config: defaultPresetAdoptionConfig,
        });
      },
    );

    it.effect("says nothing about the repository", () =>
      Effect.gen(function* program() {
        const reportOverAConfigurationSwitchingNothingOff =
          yield* reportOverAConfigurationSwitchingNothingOffFixture;
        expect(reportOverAConfigurationSwitchingNothingOff).toStrictEqual({
          warnings: [],
          scanned: 2,
          configMissing: false,
        });
      }),
    );
  });

  describe("a repository holding three workspaces", () => {
    const reportOverThreeWorkspacesFixture = Effect.gen(function* reportOverThreeWorkspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
        prefix: "preset-adoption-",
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...THREE_WORKSPACES,
        "vite.config.ts": `export default defineConfig({ lint: { rules: {} } });`,
      })) {
        const writtenPath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
        yield* filesystem.writeFileString(writtenPath, writtenSource);
      }
      return yield* runPresetAdoptionChecks({
        repositoryRoot,
        config: defaultPresetAdoptionConfig,
      });
    });

    it.effect("counts every workspace it held the configuration against", () =>
      Effect.gen(function* program() {
        const reportOverThreeWorkspaces = yield* reportOverThreeWorkspacesFixture;
        expect(reportOverThreeWorkspaces).toStrictEqual({
          warnings: [],
          scanned: 3,
          configMissing: false,
        });
      }),
    );
  });

  describe("an override that names one workspace", () => {
    const reportOverAnOverrideNamingOneWorkspaceFixture = Effect.gen(
      function* reportOverAnOverrideNamingOneWorkspace() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "preset-adoption-",
        });
        for (const [relativePath, writtenSource] of Object.entries({
          ...TWO_WORKSPACES,
          "vite.config.ts": `export default defineConfig({
  lint: {
    overrides: [
      {
        files: ["packages/left/**"],
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
      },
    ],
  },
});`,
        })) {
          const writtenPath = paths.join(repositoryRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
          yield* filesystem.writeFileString(writtenPath, writtenSource);
        }
        return yield* runPresetAdoptionChecks({
          repositoryRoot,
          config: defaultPresetAdoptionConfig,
        });
      },
    );

    it.effect("names only the workspace the override reaches", () =>
      Effect.gen(function* program() {
        const reportOverAnOverrideNamingOneWorkspace =
          yield* reportOverAnOverrideNamingOneWorkspaceFixture;
        expect(reportOverAnOverrideNamingOneWorkspace).toStrictEqual({
          warnings: [
            {
              file: "vite.config.ts",
              line: 6,
              message:
                "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
            },
          ],
          scanned: 2,
          configMissing: false,
        });
      }),
    );
  });

  describe("a rule switched off without a path", () => {
    const reportOverARuleSwitchedOffWithoutAPathFixture = Effect.gen(
      function* reportOverARuleSwitchedOffWithoutAPath() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "preset-adoption-",
        });
        for (const [relativePath, writtenSource] of Object.entries({
          ...TWO_WORKSPACES,
          "vite.config.ts": `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } },
});`,
        })) {
          const writtenPath = paths.join(repositoryRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
          yield* filesystem.writeFileString(writtenPath, writtenSource);
        }
        return yield* runPresetAdoptionChecks({
          repositoryRoot,
          config: defaultPresetAdoptionConfig,
        });
      },
    );

    it.effect("names every workspace the configuration covers", () =>
      Effect.gen(function* program() {
        const reportOverARuleSwitchedOffWithoutAPath =
          yield* reportOverARuleSwitchedOffWithoutAPathFixture;
        expect(reportOverARuleSwitchedOffWithoutAPath).toStrictEqual({
          warnings: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
            },
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/right. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
            },
          ],
          scanned: 2,
          configMissing: false,
        });
      }),
    );
  });

  describe("an override written on one line", () => {
    const reportOverAnOverrideWrittenOnOneLineFixture = Effect.gen(
      function* reportOverAnOverrideWrittenOnOneLine() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "preset-adoption-",
        });
        for (const [relativePath, writtenSource] of Object.entries({
          ...TWO_WORKSPACES,
          "vite.config.ts": `export default defineConfig({
  lint: { overrides: [{ files: ["packages/right/**"], rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } }] },
});`,
        })) {
          const writtenPath = paths.join(repositoryRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
          yield* filesystem.writeFileString(writtenPath, writtenSource);
        }
        return yield* runPresetAdoptionChecks({
          repositoryRoot,
          config: defaultPresetAdoptionConfig,
        });
      },
    );

    it.effect("points at the line the configuration switches the rule off on", () =>
      Effect.gen(function* program() {
        const reportOverAnOverrideWrittenOnOneLine =
          yield* reportOverAnOverrideWrittenOnOneLineFixture;
        expect(reportOverAnOverrideWrittenOnOneLine).toStrictEqual({
          warnings: [
            {
              file: "vite.config.ts",
              line: 2,
              message:
                "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/right. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
            },
          ],
          scanned: 2,
          configMissing: false,
        });
      }),
    );
  });

  describe("a repository without a toolchain configuration", () => {
    const reportOverARepositoryWithoutAToolchainConfigurationFixture = Effect.gen(
      function* reportOverARepositoryWithoutAToolchainConfiguration() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "preset-adoption-",
        });
        for (const [relativePath, writtenSource] of Object.entries(TWO_WORKSPACES)) {
          const writtenPath = paths.join(repositoryRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
          yield* filesystem.writeFileString(writtenPath, writtenSource);
        }
        return yield* runPresetAdoptionChecks({
          repositoryRoot,
          config: defaultPresetAdoptionConfig,
        });
      },
    );

    it.effect("reports nothing and says why", () =>
      Effect.gen(function* program() {
        const reportOverARepositoryWithoutAToolchainConfiguration =
          yield* reportOverARepositoryWithoutAToolchainConfigurationFixture;
        expect(reportOverARepositoryWithoutAToolchainConfiguration).toStrictEqual({
          warnings: [],
          scanned: 2,
          configMissing: true,
        });
      }),
    );
  });
});
