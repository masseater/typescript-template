import { lstat, readlink, stat } from "node:fs/promises";
import path from "node:path";

import { repositoryRoot } from "./repository-root.ts";

import type { WorkspaceManifest } from "./dependencies.ts";

const instructionFile = "AGENTS.md";
const linkFile = "CLAUDE.md";

const workspaceDirectories = (workspaces: readonly WorkspaceManifest[]): string[] => {
  return workspaces.map(({ file }) => path.posix.dirname(file));
};

const isFile = async (target: string): Promise<boolean> => {
  try {
    const stats = await stat(target);
    return stats.isFile();
  } catch {
    return false;
  }
};

const linkTarget = async (target: string): Promise<string | undefined> => {
  try {
    const stats = await lstat(target);
    return stats.isSymbolicLink() ? await readlink(target) : undefined;
  } catch {
    return undefined;
  }
};

const directoryViolations = async (root: string, directory: string): Promise<string[]> => {
  const hasInstructions = await isFile(path.join(root, directory, instructionFile));
  const target = await linkTarget(path.join(root, directory, linkFile));
  return [
    ...(hasInstructions
      ? []
      : [
          `${directory}: ${instructionFile} を置いてください。書き方は .claude/skills/reviews/references/agents-md.md にあります。`,
        ]),
    ...(target === instructionFile
      ? []
      : [`${directory}: ${linkFile} を ${instructionFile} へのシンボリックリンクにしてください。`]),
  ];
};

const instructionViolations = async (
  root: string,
  directories: readonly string[],
): Promise<string[]> => {
  const violations = await Promise.all(
    directories.map(async (directory) => directoryViolations(root, directory)),
  );
  return violations.flat();
};

export { instructionViolations, workspaceDirectories };
export { repositoryRoot } from "./repository-root.ts";
