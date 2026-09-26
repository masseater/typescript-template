import { path, posixPath } from "../platform/path.ts";
import { repositoryRoot } from "./repository-root.ts";

const qualityDirectory = import.meta.dirname;

const repositoryRelative = (fromQuality: string): string =>
  path.relative(repositoryRoot, path.resolve(qualityDirectory, fromQuality));

const directoryOfGlobKey = (key: string): string =>
  posixPath.dirname(repositoryRelative(key)) || ".";

export { directoryOfGlobKey, repositoryRelative };
