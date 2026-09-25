import { attempt, memoize } from "es-toolkit";

import { path, searchPathDelimiter } from "../platform/path.ts";
import { demandExecutableAt } from "../platform/synchronous-host.ts";

const GIT_FILE_NAMES: readonly string[] = ["git.exe", "git"];

const gitFileIn = (directory: string): string | null =>
  GIT_FILE_NAMES.map((fileName) => path.join(directory, fileName)).find((candidate) => {
    const [unreachableFile] = attempt(() => {
      demandExecutableAt(candidate);
    });
    return unreachableFile === null;
  }) ?? null;

export const gitExecutablePath: (searchPath: string | undefined) => string = memoize(
  (searchPath: string | undefined): string =>
    (searchPath ?? "")
      .split(searchPathDelimiter)
      .filter((directory) => directory !== "")
      .reduce<string | null>((discovered, directory) => discovered ?? gitFileIn(directory), null) ??
    "git",
  { getCacheKey: (searchPath: string | undefined) => searchPath ?? "" },
);
