import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { parseWorkflowDocument, type WorkflowDocument } from "./workflow-document.ts";

import type { WorkflowChecksConfig } from "./config.ts";

export const readWorkflowDocuments = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: WorkflowChecksConfig;
}): readonly WorkflowDocument[] => {
  const directory = join(repositoryRoot, config.workflowDirectory);
  if (!existsSync(directory)) {
    const githubDirectory = dirname(directory);
    if (existsSync(githubDirectory)) {
      readdirSync(directory);
    }
    return [];
  }
  const entryNames = readdirSync(directory);

  return entryNames
    .filter((spelled) =>
      config.workflowFileExtensions.some((extension) => spelled.endsWith(extension)),
    )
    .toSorted()
    .map((spelled) =>
      parseWorkflowDocument({
        relativePath: `${config.workflowDirectory}/${spelled}`,
        source: readFileSync(join(directory, spelled), "utf8"),
      }),
    );
};
