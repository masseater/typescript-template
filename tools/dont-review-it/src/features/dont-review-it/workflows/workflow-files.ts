import { Effect, FileSystem, type PlatformError } from "effect";

import { path } from "../platform/path.ts";
import { parseWorkflowDocument, type WorkflowDocument } from "./workflow-document.ts";

import type { WorkflowChecksConfig } from "./config.ts";

export const readWorkflowDocuments = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: WorkflowChecksConfig;
}): Effect.Effect<
  readonly WorkflowDocument[],
  PlatformError.PlatformError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* readWorkflowDocuments() {
    const filesystem = yield* FileSystem.FileSystem;
    const directory = path.join(repositoryRoot, config.workflowDirectory);
    if (!(yield* filesystem.exists(directory))) {
      if (yield* filesystem.exists(path.dirname(directory))) {
        yield* filesystem.readDirectory(directory);
      }
      return [];
    }
    const entryNames = yield* filesystem.readDirectory(directory);

    return yield* Effect.forEach(
      entryNames
        .filter((spelled) =>
          config.workflowFileExtensions.some((extension) => spelled.endsWith(extension)),
        )
        .toSorted(),
      (spelled) =>
        filesystem.readFileString(path.join(directory, spelled)).pipe(
          Effect.map((source) =>
            parseWorkflowDocument({
              relativePath: `${config.workflowDirectory}/${spelled}`,
              source,
            }),
          ),
        ),
    );
  });
