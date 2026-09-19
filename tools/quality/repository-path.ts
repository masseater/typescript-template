import path from "node:path";

import { repositoryRoot } from "./repository-root.ts";

const qualityDirectory = import.meta.dirname;

const repositoryRelative = (fromQuality: string): string => {
  return path.relative(repositoryRoot, path.resolve(qualityDirectory, fromQuality));
};

const directoryOfGlobKey = (key: string): string => {
  return path.posix.dirname(repositoryRelative(key)) || ".";
};

export { directoryOfGlobKey, repositoryRelative };
