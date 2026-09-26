import { repositoryRoot } from "@repo/config/repository-root";

import { path, posixPath } from "../platform/path.ts";

const qualityDirectory = import.meta.dirname;

const repositoryRelative = (fromQuality: string): string => {
  return path.relative(repositoryRoot, path.resolve(qualityDirectory, fromQuality));
};

const directoryOfGlobKey = (key: string): string => {
  return posixPath.dirname(repositoryRelative(key)) || ".";
};

export { directoryOfGlobKey, repositoryRelative };
