import { Effect, type FileSystem } from "effect";

import { childDirectoryNamesIn, type TreeFailure } from "./directory-entries.ts";
import { path } from "./path.ts";

export const NEGATION_PREFIX = "!";

const SINGLE_LEVEL_PATTERN_SUFFIX = "/*";

export const directoriesMatching = ({
  repositoryRoot,
  pattern,
}: {
  readonly repositoryRoot: string;
  readonly pattern: string;
}): Effect.Effect<readonly string[], TreeFailure, FileSystem.FileSystem> => {
  if (pattern.startsWith(NEGATION_PREFIX)) return Effect.succeed([]);
  if (!pattern.endsWith(SINGLE_LEVEL_PATTERN_SUFFIX)) return Effect.succeed([pattern]);

  const parentDirectory = pattern.slice(0, -SINGLE_LEVEL_PATTERN_SUFFIX.length);
  return childDirectoryNamesIn(path.join(repositoryRoot, parentDirectory)).pipe(
    Effect.map((childNames) =>
      childNames === null ? [] : childNames.map((childName) => `${parentDirectory}/${childName}`),
    ),
  );
};
