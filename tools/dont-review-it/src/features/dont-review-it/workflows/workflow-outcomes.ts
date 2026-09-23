import { Effect, type FileSystem, type PlatformError } from "effect";

import { actionUpdateProblems } from "./action-updates.ts";
import { runWorkflowChecks } from "./run-workflow-checks.ts";

import type { ScannedProblems } from "../repository-checks/index.ts";
import type { WorkflowChecksConfig } from "./config.ts";

export type WorkflowOutcomes = {
  readonly definitions: ScannedProblems;
  readonly updates: ScannedProblems;
};

export const workflowOutcomesOf = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: WorkflowChecksConfig;
}): Effect.Effect<WorkflowOutcomes, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* workflowOutcomesOf() {
    const definitions = yield* runWorkflowChecks({ repositoryRoot, config });

    return {
      definitions,
      updates:
        definitions.scanned === 0
          ? { problems: [], scanned: 0 }
          : yield* actionUpdateProblems({ repositoryRoot, config }),
    };
  });
