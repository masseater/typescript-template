import { Effect, type FileSystem, type PlatformError } from "effect";

import { textOrNull } from "../platform/file-system.ts";
import { path } from "../platform/path.ts";
import {
  itemsOf,
  parseWorkflowDocument,
  scalarText,
  valueOf,
  type WorkflowDocument,
} from "./workflow-document.ts";

import type { ScannedProblems } from "../repository-checks/index.ts";
import type { WorkflowChecksConfig } from "./config.ts";

const firstReadable = ({
  repositoryRoot,
  paths,
}: {
  readonly repositoryRoot: string;
  readonly paths: readonly string[];
}): Effect.Effect<WorkflowDocument | null, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* firstReadable() {
    const sources = yield* Effect.forEach(paths, (relativePath) =>
      textOrNull(path.join(repositoryRoot, relativePath)).pipe(
        Effect.map((source) => (source === null ? null : { relativePath, source })),
      ),
    );
    const found = sources.find((readable) => readable !== null);
    return found === undefined || found === null ? null : parseWorkflowDocument(found);
  });

const coversActions = ({
  definition,
  config,
}: {
  readonly definition: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): boolean =>
  itemsOf(valueOf(definition.root, config.updatesKey)).some(
    (update) => scalarText(valueOf(update, config.packageEcosystemKey)) === config.actionsEcosystem,
  );

export const actionUpdateProblems = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: WorkflowChecksConfig;
}): Effect.Effect<ScannedProblems, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* actionUpdateProblems() {
    if ((yield* firstReadable({ repositoryRoot, paths: config.renovateConfigPaths })) !== null) {
      return { problems: [], scanned: 1 };
    }

    const definition = yield* firstReadable({
      repositoryRoot,
      paths: config.dependabotConfigPaths,
    });
    if (definition === null) {
      return {
        problems: [
          {
            file: config.workflowDirectory,
            line: null,
            message: `A repository that pins its action references must not leave the pins without something that raises them, because a pin holds an action at the version it had on the day it was written and nothing afterwards notices that the version aged. Which pin is current cannot be settled by reading this repository, so what is required here is the mechanism rather than the answer. Add a Renovate configuration, or a Dependabot configuration whose \`${config.updatesKey}\` cover the \`${config.actionsEcosystem}\` ecosystem, so every pinned commit SHA is raised in a pull request that a person reviews.`,
          },
        ],
        scanned: 0,
      };
    }

    if (coversActions({ definition, config })) return { problems: [], scanned: 1 };

    return {
      problems: [
        {
          file: definition.relativePath,
          line: 1,
          message: `A dependency update configuration must not leave the workflows out, because the actions they pin run with more access than anything else in the repository and are read by nobody once pinned. Add an entry to \`${config.updatesKey}\` whose \`${config.packageEcosystemKey}\` is \`${config.actionsEcosystem}\`, so the pinned commit SHAs are raised alongside the rest of the dependencies.`,
        },
      ],
      scanned: 1,
    };
  });
