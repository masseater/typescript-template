import { gitOutput, repositoryRootOf, runGit, type GitRunner } from "./git.ts";

export const removeWorktree = (worktreePath: string, run: GitRunner = runGit): void => {
  const repositoryRoot = repositoryRootOf(run, worktreePath);
  if (repositoryRoot === undefined) {
    throw new Error(`worktree-home: ${worktreePath} is not a git worktree`);
  }
  gitOutput(run, { cwd: repositoryRoot, handed: ["worktree", "remove", worktreePath] });
};
