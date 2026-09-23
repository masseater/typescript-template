import { memoize } from "es-toolkit";

import { path } from "../../../../platform/path.ts";
import {
  listRepositoryFiles,
  readTextFile,
  type ScannedFile,
} from "../canonical-values/source-files.ts";
import { isOutOfScopeSource } from "../out-of-scope-source.ts";
import {
  buildValueDeclarationIndex,
  type IndexedValueFile,
  type ValueDeclarationIndex,
} from "./declaration-index.ts";
import { valueDeclarationsIn } from "./declarations.ts";

const readValueFileAt = (file: ScannedFile): IndexedValueFile | null => {
  const source = readTextFile(file.absolutePath);
  if (source === null) return null;

  const declarations = valueDeclarationsIn({ source, relativePath: file.relativePath });
  return declarations.length === 0 ? null : { relativePath: file.relativePath, declarations };
};

const buildRepositoryValueDeclarationIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): ValueDeclarationIndex => {
  const { declarationSources } = listRepositoryFiles(path.resolve(repositoryRoot));

  return buildValueDeclarationIndex(
    declarationSources
      .filter((file) => !isOutOfScopeSource(file.relativePath))
      .map(readValueFileAt)
      .filter((file) => file !== null),
  );
};

const valueDeclarationIndexAt = memoize((repositoryRoot: string): ValueDeclarationIndex =>
  buildRepositoryValueDeclarationIndex({ repositoryRoot }),
);

export const loadRepositoryValueDeclarationIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): ValueDeclarationIndex => valueDeclarationIndexAt(path.resolve(repositoryRoot));
