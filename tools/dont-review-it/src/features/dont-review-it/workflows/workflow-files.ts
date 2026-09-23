import { Effect, FileSystem, type PlatformError } from "effect";

import { pathExists, unlessMissing } from "../platform/file-system.ts";
import { path, posixPath } from "../platform/path.ts";
import { parseWorkflowDocument, type WorkflowDocument } from "./workflow-document.ts";

import type { WorkflowChecksConfig } from "./config.ts";

type WorkflowTree =
  | { readonly kind: "no-ci-tree" }
  | { readonly kind: "workflows-omitted" }
  | { readonly kind: "read"; readonly documents: readonly WorkflowDocument[] };

export const readWorkflowDocuments = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: WorkflowChecksConfig;
}): Effect.Effect<WorkflowTree, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* readWorkflowDocuments() {
    const filesystem = yield* FileSystem.FileSystem;
    const directory = path.join(repositoryRoot, config.workflowDirectory);
    const entryNames = yield* unlessMissing(filesystem.readDirectory(directory));
    if (entryNames === null) {
      return (yield* pathExists(path.dirname(directory)))
        ? { kind: "workflows-omitted" }
        : { kind: "no-ci-tree" };
    }

    const documents = yield* Effect.forEach(
      entryNames
        .filter((spelled) =>
          config.workflowFileExtensions.some((extension) => spelled.endsWith(extension)),
        )
        .toSorted(),
      (spelled) =>
        filesystem.readFileString(path.join(directory, spelled)).pipe(
          Effect.map((source) =>
            parseWorkflowDocument({
              relativePath: posixPath.join(config.workflowDirectory, spelled),
              source,
            }),
          ),
        ),
    );
    return { kind: "read", documents };
  });
