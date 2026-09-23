import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { actionUpdateProblems } from "./action-updates.ts";
import { defaultWorkflowChecksConfig } from "./config.ts";

const MISSING_MECHANISM_MESSAGE =
  "A repository that pins its action references must not leave the pins without something that raises them, because a pin holds an action at the version it had on the day it was written and nothing afterwards notices that the version aged. Which pin is current cannot be settled by reading this repository, so what is required here is the mechanism rather than the answer. Add a Renovate configuration, or a Dependabot configuration whose `updates` cover the `github-actions` ecosystem, so every pinned commit SHA is raised in a pull request that a person reviews.";

const WORKFLOWS_LEFT_OUT_MESSAGE =
  "A dependency update configuration must not leave the workflows out, because the actions they pin run with more access than anything else in the repository and are read by nobody once pinned. Add an entry to `updates` whose `package-ecosystem` is `github-actions`, so the pinned commit SHAs are raised alongside the rest of the dependencies.";

layer(NodeServices.layer)("actionUpdateProblems", (it) => {
  describe("a repository that names no update mechanism at all", () => {
    const reportForARepositoryNamingNoMechanismFixture = Effect.gen(
      function* reportForARepositoryNamingNoMechanism() {
        const filesystem = yield* FileSystem.FileSystem;
        return yield* actionUpdateProblems({
          repositoryRoot: yield* filesystem.makeTempDirectoryScoped({
            prefix: "action-updates-bare-",
          }),
          config: defaultWorkflowChecksConfig,
        });
      },
    );

    it.effect("reports a repository that names no mechanism at all", () =>
      Effect.gen(function* program() {
        const reportForARepositoryNamingNoMechanism =
          yield* reportForARepositoryNamingNoMechanismFixture;
        expect(reportForARepositoryNamingNoMechanism).toStrictEqual({
          problems: [
            {
              file: ".github/workflows",
              line: null,
              message: MISSING_MECHANISM_MESSAGE,
            },
          ],
          scanned: 0,
        });
      }),
    );
  });

  describe("a repository where nothing raises the pins", () => {
    const reportForARepositoryWherePinsGoUnraisedFixture = Effect.gen(
      function* reportForARepositoryWherePinsGoUnraised() {
        const filesystem = yield* FileSystem.FileSystem;
        return yield* actionUpdateProblems({
          repositoryRoot: yield* filesystem.makeTempDirectoryScoped({
            prefix: "action-updates-bare-location-",
          }),
          config: defaultWorkflowChecksConfig,
        });
      },
    );

    it.effect("points at the workflow directory when nothing raises the pins", () =>
      Effect.gen(function* program() {
        const reportForARepositoryWherePinsGoUnraised =
          yield* reportForARepositoryWherePinsGoUnraisedFixture;
        expect(reportForARepositoryWherePinsGoUnraised).toStrictEqual({
          problems: [
            {
              file: ".github/workflows",
              line: null,
              message: MISSING_MECHANISM_MESSAGE,
            },
          ],
          scanned: 0,
        });
      }),
    );
  });

  describe("a repository carrying a Renovate configuration at its root", () => {
    const reportForARepositoryConfiguringRenovateFixture = Effect.gen(
      function* reportForARepositoryConfiguringRenovate() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "action-updates-renovate-",
        });
        yield* filesystem.writeFileString(paths.join(repositoryRoot, "renovate.json"), "{}\n");
        return yield* actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
      },
    );

    it.effect("leaves a repository that configures Renovate alone", () =>
      Effect.gen(function* program() {
        const reportForARepositoryConfiguringRenovate =
          yield* reportForARepositoryConfiguringRenovateFixture;
        expect(reportForARepositoryConfiguringRenovate).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a repository carrying a Renovate configuration in the platform directory", () => {
    const reportForARepositoryConfiguringRenovateUnderThePlatformDirectoryFixture = Effect.gen(
      function* reportForARepositoryConfiguringRenovateUnderThePlatformDirectory() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "action-updates-renovate-github-",
        });
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".github"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, ".github", "renovate.json5"),
          "{}\n",
        );
        return yield* actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
      },
    );

    it.effect("accepts the configuration Renovate reads from the platform directory", () =>
      Effect.gen(function* program() {
        const reportForARepositoryConfiguringRenovateUnderThePlatformDirectory =
          yield* reportForARepositoryConfiguringRenovateUnderThePlatformDirectoryFixture;
        expect(reportForARepositoryConfiguringRenovateUnderThePlatformDirectory).toStrictEqual({
          problems: [],
          scanned: 1,
        });
      }),
    );
  });

  describe("a Dependabot configuration whose updates cover the actions", () => {
    const reportForADependabotConfigurationCoveringTheActionsFixture = Effect.gen(
      function* reportForADependabotConfigurationCoveringTheActions() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "action-updates-dependabot-covering-",
        });
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".github"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, ".github", "dependabot.yml"),
          "version: 2\nupdates:\n  - package-ecosystem: github-actions\n    directory: /\n",
        );
        return yield* actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
      },
    );

    it.effect("leaves a Dependabot configuration that covers the actions alone", () =>
      Effect.gen(function* program() {
        const reportForADependabotConfigurationCoveringTheActions =
          yield* reportForADependabotConfigurationCoveringTheActionsFixture;
        expect(reportForADependabotConfigurationCoveringTheActions).toStrictEqual({
          problems: [],
          scanned: 1,
        });
      }),
    );
  });

  describe("a Dependabot configuration whose updates cover everything but the actions", () => {
    const reportForADependabotConfigurationSkippingTheActionsFixture = Effect.gen(
      function* reportForADependabotConfigurationSkippingTheActions() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "action-updates-dependabot-partial-",
        });
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".github"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, ".github", "dependabot.yml"),
          "version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n",
        );
        return yield* actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
      },
    );

    it.effect("reports a Dependabot configuration that covers everything but the actions", () =>
      Effect.gen(function* program() {
        const reportForADependabotConfigurationSkippingTheActions =
          yield* reportForADependabotConfigurationSkippingTheActionsFixture;
        expect(reportForADependabotConfigurationSkippingTheActions).toStrictEqual({
          problems: [
            {
              file: ".github/dependabot.yml",
              line: 1,
              message: WORKFLOWS_LEFT_OUT_MESSAGE,
            },
          ],
          scanned: 1,
        });
      }),
    );
  });

  describe("a repository whose single mechanism is counted", () => {
    const reportForACountedRenovateConfigurationFixture = Effect.gen(
      function* reportForACountedRenovateConfiguration() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "action-updates-renovate-count-",
        });
        yield* filesystem.writeFileString(paths.join(repositoryRoot, "renovate.json"), "{}\n");
        return yield* actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
      },
    );

    it.effect("counts the mechanism it found", () =>
      Effect.gen(function* program() {
        const reportForACountedRenovateConfiguration =
          yield* reportForACountedRenovateConfigurationFixture;
        expect(reportForACountedRenovateConfiguration).toStrictEqual({ problems: [], scanned: 1 });
      }),
    );
  });

  describe("a repository holding no mechanism to count", () => {
    const reportForARepositoryHoldingNothingToCountFixture = Effect.gen(
      function* reportForARepositoryHoldingNothingToCount() {
        const filesystem = yield* FileSystem.FileSystem;
        return yield* actionUpdateProblems({
          repositoryRoot: yield* filesystem.makeTempDirectoryScoped({
            prefix: "action-updates-bare-count-",
          }),
          config: defaultWorkflowChecksConfig,
        });
      },
    );

    it.effect("counts nothing when it found no mechanism", () =>
      Effect.gen(function* program() {
        const reportForARepositoryHoldingNothingToCount =
          yield* reportForARepositoryHoldingNothingToCountFixture;
        expect(reportForARepositoryHoldingNothingToCount).toStrictEqual({
          problems: [
            {
              file: ".github/workflows",
              line: null,
              message: MISSING_MECHANISM_MESSAGE,
            },
          ],
          scanned: 0,
        });
      }),
    );
  });

  describe("a Dependabot configuration that left the actions out", () => {
    const reportLocatingTheDependabotConfigurationThatLeftTheActionsOutFixture = Effect.gen(
      function* reportLocatingTheDependabotConfigurationThatLeftTheActionsOut() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "action-updates-dependabot-partial-location-",
        });
        yield* filesystem.makeDirectory(paths.join(repositoryRoot, ".github"), { recursive: true });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, ".github", "dependabot.yml"),
          "version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n",
        );
        return yield* actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
      },
    );

    it.effect("points at the configuration that left the actions out", () =>
      Effect.gen(function* program() {
        const reportLocatingTheDependabotConfigurationThatLeftTheActionsOut =
          yield* reportLocatingTheDependabotConfigurationThatLeftTheActionsOutFixture;
        expect(reportLocatingTheDependabotConfigurationThatLeftTheActionsOut).toStrictEqual({
          problems: [
            {
              file: ".github/dependabot.yml",
              line: 1,
              message: WORKFLOWS_LEFT_OUT_MESSAGE,
            },
          ],
          scanned: 1,
        });
      }),
    );
  });
});
