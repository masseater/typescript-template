export const insideRepositoryReason = (destination: string, repositoryRoot: string): string =>
  [
    `worktree-home: the worktree would be created at ${destination}, inside the repository ${repositoryRoot}.`,
    "A worktree nested in the repository is swept by the repository's own lint ignores and resolves packages and tsconfig through the outer checkout, so checks silently skip it or fail on it.",
    "",
    "Create it outside the repository instead:",
    "- a new branch: use the EnterWorktree tool; the WorktreeCreate hook places it under ~/worktrees/<host>/<owner>/<repo>/<name> from the latest default branch",
    "- an existing branch: `git worktree add ~/worktrees/<host>/<owner>/<repo>/<branch> <branch>`, or `gwq add` where gwq is installed",
  ].join("\n");

export const unresolvedDestinationReason = [
  "worktree-home: the path of `git worktree add` could not be read as a literal path, so whether it lands inside the repository cannot be checked.",
  "Write the destination as a literal path outside the repository, such as ~/worktrees/<host>/<owner>/<repo>/<branch>.",
].join("\n");
