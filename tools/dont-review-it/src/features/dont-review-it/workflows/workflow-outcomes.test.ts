import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "./config.ts";
import { workflowOutcomesOf } from "./workflow-outcomes.ts";

const WORKFLOW_PATH = ".github/workflows/ci.yml";

const GATED_WORKFLOW = `on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`;

layer(NodeServices.layer)("workflowOutcomesOf", (it) => {
  describe("a repository holding a workflow definition beside a renovate configuration", () => {
    const outcomesOfGatedRepositoryOnRenovateFixture = Effect.gen(
      function* outcomesOfGatedRepositoryOnRenovate() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-workflow-outcomes-",
        });
        const workflowFile = paths.join(repositoryRoot, WORKFLOW_PATH);
        yield* filesystem.makeDirectory(paths.dirname(workflowFile), { recursive: true });
        yield* filesystem.writeFileString(workflowFile, GATED_WORKFLOW);
        yield* filesystem.writeFileString(paths.join(repositoryRoot, "renovate.json"), "{}\n");
        return yield* workflowOutcomesOf({ repositoryRoot, config: defaultWorkflowChecksConfig });
      },
    );

    it.effect("counts the definition it read", () =>
      Effect.gen(function* program() {
        const outcomesOfGatedRepositoryOnRenovate =
          yield* outcomesOfGatedRepositoryOnRenovateFixture;
        expect(outcomesOfGatedRepositoryOnRenovate).toStrictEqual({
          definitions: { problems: [], scanned: 1 },
          updates: { problems: [], scanned: 1 },
        });
      }),
    );
  });

  describe("a repository holding a workflow definition with no update mechanism", () => {
    const outcomesOfGatedRepositoryWithoutMechanismFixture = Effect.gen(
      function* outcomesOfGatedRepositoryWithoutMechanism() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-workflow-outcomes-",
        });
        const workflowFile = paths.join(repositoryRoot, WORKFLOW_PATH);
        yield* filesystem.makeDirectory(paths.dirname(workflowFile), { recursive: true });
        yield* filesystem.writeFileString(workflowFile, GATED_WORKFLOW);
        return yield* workflowOutcomesOf({ repositoryRoot, config: defaultWorkflowChecksConfig });
      },
    );

    it.effect("looks for the update mechanism once a definition exists", () =>
      Effect.gen(function* program() {
        const outcomesOfGatedRepositoryWithoutMechanism =
          yield* outcomesOfGatedRepositoryWithoutMechanismFixture;
        expect(outcomesOfGatedRepositoryWithoutMechanism).toStrictEqual({
          definitions: { problems: [], scanned: 1 },
          updates: {
            problems: [
              {
                file: ".github/workflows",
                line: null,
                message:
                  "A repository that pins its action references must not leave the pins without something that raises them, because a pin holds an action at the version it had on the day it was written and nothing afterwards notices that the version aged. Which pin is current cannot be settled by reading this repository, so what is required here is the mechanism rather than the answer. Add a Renovate configuration, or a Dependabot configuration whose `updates` cover the `github-actions` ecosystem, so every pinned commit SHA is raised in a pull request that a person reviews.",
              },
            ],
            scanned: 0,
          },
        });
      }),
    );
  });

  describe("a repository holding no workflow definition", () => {
    const outcomesOfRepositoryWithoutDefinitionFixture = Effect.gen(
      function* outcomesOfRepositoryWithoutDefinition() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "dont-review-it-workflow-outcomes-",
        });
        yield* filesystem.writeFileString(
          paths.join(repositoryRoot, "package.json"),
          `{"name": "solo"}`,
        );
        return yield* workflowOutcomesOf({ repositoryRoot, config: defaultWorkflowChecksConfig });
      },
    );

    it.effect("leaves the update mechanism unasked for when no definition exists", () =>
      Effect.gen(function* program() {
        const outcomesOfRepositoryWithoutDefinition =
          yield* outcomesOfRepositoryWithoutDefinitionFixture;
        expect(outcomesOfRepositoryWithoutDefinition).toStrictEqual({
          definitions: { problems: [], scanned: 0 },
          updates: { problems: [], scanned: 0 },
        });
      }),
    );
  });
});
