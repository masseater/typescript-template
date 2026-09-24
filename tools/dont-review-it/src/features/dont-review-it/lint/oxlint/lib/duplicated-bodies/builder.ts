import { memoize } from "es-toolkit";

import { path } from "../../../../platform/path.ts";
import {
  listRepositoryFiles,
  readTextFile,
  type ScannedFile,
} from "../canonical-values/source-files.ts";
import { isOutOfScopeSource } from "../out-of-scope-source.ts";
import { buildBodyIndex, EMPTY_BODY_INDEX, type BodyIndex } from "./body-index.ts";
import { declarationsIn } from "./declarations.ts";
import { separatedByPrivateBindings, type ReferencingFile } from "./private-bindings.ts";

const indexedFileAt = (file: ScannedFile): ReferencingFile | null => {
  const source = readTextFile(file.absolutePath);
  if (source === null) return null;

  const declarationFingerprints = declarationsIn(source).map((declaration) => ({
    name: declaration.name,
    line: declaration.line,
    fingerprint: declaration.structure,
    nodeCount: declaration.nodeCount,
    references: declaration.references,
  }));
  return declarationFingerprints.length === 0
    ? null
    : { relativePath: file.relativePath, bodies: declarationFingerprints };
};

export const buildRepositoryBodyIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): BodyIndex => {
  const root = path.resolve(repositoryRoot);
  const { declarationSources } = listRepositoryFiles(root);
  const scanned = declarationSources.filter((file) => !isOutOfScopeSource(file.relativePath));
  if (scanned.length === 0) return EMPTY_BODY_INDEX;

  return buildBodyIndex(
    separatedByPrivateBindings({
      repositoryRoot: root,
      files: scanned.map(indexedFileAt).filter((file) => file !== null),
    }),
  );
};

const bodyIndexUnder = memoize((repositoryRoot: string): BodyIndex =>
  buildRepositoryBodyIndex({ repositoryRoot }),
);

export const loadRepositoryBodyIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): BodyIndex => bodyIndexUnder(path.resolve(repositoryRoot));
