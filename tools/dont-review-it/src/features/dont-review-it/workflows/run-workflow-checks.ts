import { failureCodeOf } from "../repository-checks/index.ts";
import { crossWorkflowChains } from "./checks/cross-workflow-chain.ts";
import { undeclaredPermissions } from "./checks/declared-permissions.ts";
import { gatingTriggerFilters } from "./checks/gating-trigger-filter.ts";
import { unboundedHistoryFetches } from "./checks/history-fetch-depth.ts";
import { maskedFailures } from "./checks/masked-failure.ts";
import { unpinnedActionRefs } from "./checks/pinned-action-ref.ts";
import { reusableWorkflowTriggers } from "./checks/reusable-workflow-trigger.ts";
import { multiCommandRuns } from "./checks/single-command-run.ts";
import { lineAtOffset, type WorkflowDocument } from "./workflow-document.ts";
import { readWorkflowDocuments } from "./workflow-files.ts";

import type { RepositoryProblem } from "../problem.ts";
import type { ScannedProblems } from "../repository-checks/index.ts";
import type { WorkflowChecksConfig } from "./config.ts";

const unreadableDefinition = (document: WorkflowDocument): readonly RepositoryProblem[] =>
  document.parseFailureOffsets.map((offset) => ({
    file: document.relativePath,
    line: lineAtOffset(document, offset),
    message: `A workflow definition that does not parse must not stay in the repository, because every check below reads it as an empty file and reports nothing. Fix the YAML here so the definition can be read.`,
  }));

const problemsIn = ({
  document,
  config,
}: {
  readonly document: WorkflowDocument;
  readonly config: WorkflowChecksConfig;
}): readonly RepositoryProblem[] => {
  const unreadable = unreadableDefinition(document);
  if (unreadable.length > 0) return unreadable;

  return [
    ...gatingTriggerFilters({ document, config }),
    ...reusableWorkflowTriggers({ document, config }),
    ...crossWorkflowChains({ document, config }),
    ...undeclaredPermissions({ document, config }),
    ...multiCommandRuns({ document, config }),
    ...maskedFailures({ document, config }),
    ...unpinnedActionRefs({ document, config }),
    ...unboundedHistoryFetches({ document, config }),
  ];
};

const byLocation = (left: RepositoryProblem, right: RepositoryProblem): number =>
  left.file === right.file
    ? Number(left.line) - Number(right.line)
    : left.file.localeCompare(right.file);

export const runWorkflowChecks = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: WorkflowChecksConfig;
}): ScannedProblems => {
  try {
    const documents = readWorkflowDocuments({ repositoryRoot, config });
    return {
      problems: documents
        .flatMap((document) => problemsIn({ document, config }))
        .toSorted(byLocation),
      scanned: documents.length,
    };
  } catch (failure) {
    if (failureCodeOf(failure) !== "ENOENT") throw failure;
    return {
      problems: [
        {
          file: config.workflowDirectory,
          line: null,
          message: `A repository that keeps ${config.workflowDirectory.replace(/\/workflows$/, "")} must not omit the workflows tree, because a missing directory is read as an empty scan and every workflow check then reports success with nothing examined. Create ${config.workflowDirectory} or remove the parent if this repository has no CI workflows.`,
        },
      ],
      scanned: 0,
    };
  }
};
