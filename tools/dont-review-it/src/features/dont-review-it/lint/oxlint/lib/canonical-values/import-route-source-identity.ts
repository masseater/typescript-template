import { attempt } from "es-toolkit";

import { path } from "../../../../platform/path.ts";
import { nativeRealPathOf } from "../../../../platform/synchronous-host.ts";
import { pathIsInside } from "../path-is-inside.ts";

export type RepositoryModuleLocation =
  | { readonly kind: "external" }
  | {
      readonly kind: "repository";
      readonly path: string;
      readonly sourcePaths: readonly string[];
    };

export const realPathOf = (filePath: string): string => {
  const absolutePath = path.resolve(filePath);
  const [failure, realPath] = attempt(() => nativeRealPathOf(absolutePath));
  return failure === null && realPath !== null ? realPath : absolutePath;
};

const lexicalRepositorySource = (repositoryRoot: string, resolvedPath: string): string | null => {
  const sourcePath = path.resolve(resolvedPath);
  if (!pathIsInside(repositoryRoot, sourcePath)) return null;
  return path.relative(repositoryRoot, sourcePath).split(path.sep).includes("node_modules")
    ? null
    : sourcePath;
};

export const repositoryModuleLocation = ({
  repositoryRoot: rawRepositoryRoot,
  resolvedPath,
}: {
  readonly repositoryRoot: string;
  readonly resolvedPath: string;
}): RepositoryModuleLocation => {
  const repositoryRoot = realPathOf(rawRepositoryRoot);
  const filePath = realPathOf(resolvedPath);
  if (!pathIsInside(repositoryRoot, filePath)) return { kind: "external" };
  if (path.relative(repositoryRoot, filePath).split(path.sep).includes("node_modules")) {
    return { kind: "external" };
  }
  const lexicalPath = lexicalRepositorySource(path.resolve(rawRepositoryRoot), resolvedPath);
  const sourcePaths =
    lexicalPath === null || lexicalPath === filePath ? [filePath] : [filePath, lexicalPath];
  return { kind: "repository", path: filePath, sourcePaths };
};
