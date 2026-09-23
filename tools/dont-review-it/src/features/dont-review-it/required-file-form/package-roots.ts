import { uniq } from "es-toolkit";

import { listRepositoryFiles } from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { posixPath } from "../platform/path.ts";

const REPOSITORY_ROOT = ".";

export const packageRootsIn = (repositoryRoot: string): readonly string[] =>
  uniq([
    REPOSITORY_ROOT,
    ...listRepositoryFiles(repositoryRoot).manifests.map((manifest) =>
      posixPath.dirname(manifest.relativePath),
    ),
  ]).toSorted();
