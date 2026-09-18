// oxlint-disable-next-line import/no-nodejs-modules
import { lstat, readlink, stat } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";

import type { WorkspaceManifest } from "./dependencies.ts";

const instructionFile = "AGENTS.md";
const linkFile = "CLAUDE.md";
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

function workspaceDirectories(workspaces: readonly WorkspaceManifest[]): string[] {
  return workspaces.map(({ file }) => path.posix.dirname(file));
}

async function isFile(target: string): Promise<boolean> {
  try {
    const stats = await stat(target);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function linkTarget(target: string): Promise<string | undefined> {
  try {
    const stats = await lstat(target);
    return stats.isSymbolicLink() ? await readlink(target) : undefined;
  } catch {
    return undefined;
  }
}

async function directoryViolations(root: string, directory: string): Promise<string[]> {
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
}

async function instructionViolations(
  root: string,
  directories: readonly string[],
): Promise<string[]> {
  const violations = await Promise.all(
    directories.map(async (directory) => directoryViolations(root, directory)),
  );
  return violations.flat();
}

export { instructionViolations, repositoryRoot, workspaceDirectories };
