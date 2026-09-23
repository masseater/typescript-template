import { fileExists, joinPath, parentPath, resolvePath } from "../host.ts";

const findSpoolRoot = (currentDir: string, fallbackDir: string): string => {
  if (fileExists(joinPath(currentDir, "package.json"))) {
    return joinPath(currentDir, ".spool");
  }
  const parent = parentPath(currentDir);
  return parent === currentDir
    ? joinPath(fallbackDir, ".spool")
    : findSpoolRoot(parent, fallbackDir);
};

export const defaultSpoolRoot = (startDir: string = process.cwd()): string =>
  findSpoolRoot(resolvePath(startDir), resolvePath(startDir));

export const timestampOf = (stampedInstant: Date): string =>
  `${stampedInstant.toISOString().slice(0, 19).replaceAll(/[:-]/g, "")}Z`;

export const commandIdOf = (command: readonly [string, ...string[]]): string =>
  [command[0].split(/[\\/]/u).at(-1) ?? command[0], ...command.slice(1, 2)]
    .join(" ")
    .replaceAll(/[^\w-]+/g, "-")
    .slice(0, 40);
