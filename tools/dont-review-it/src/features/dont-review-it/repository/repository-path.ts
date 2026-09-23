import { NodePath } from "@effect/platform-node";
import { Effect, Path } from "effect";

import { path } from "../platform/path.ts";
import { repositoryRoot } from "./repository-root.ts";

const posixPath: Path.Path = Effect.runSync(Path.Path.pipe(Effect.provide(NodePath.layerPosix)));

const qualityDirectory = import.meta.dirname;

const repositoryRelative = (fromQuality: string): string => {
  return path.relative(repositoryRoot, path.resolve(qualityDirectory, fromQuality));
};

const directoryOfGlobKey = (key: string): string => {
  return posixPath.dirname(repositoryRelative(key)) || ".";
};

export { directoryOfGlobKey, posixPath, repositoryRelative };
