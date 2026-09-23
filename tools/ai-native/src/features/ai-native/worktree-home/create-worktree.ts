import { gitOutput, repositoryRootOf, runGit, type GitRunner } from "./git.ts";
import { worktreeLocationOf } from "./worktree-location.ts";

const defaultBranchOf = (run: GitRunner, repositoryRoot: string): string => {
  const remoteHead = run({
    cwd: repositoryRoot,
    handed: ["rev-parse", "--abbrev-ref", "origin/HEAD"],
  });
  if (remoteHead.status === 0) {
    return remoteHead.stdout.trim();
  }
  gitOutput(run, { cwd: repositoryRoot, handed: ["remote", "set-head", "origin", "--auto"] });
  return gitOutput(run, {
    cwd: repositoryRoot,
    handed: ["rev-parse", "--abbrev-ref", "origin/HEAD"],
  });
};

const locationFor = (
  run: GitRunner,
  placement: Readonly<{ home: string; name: string; repositoryRoot: string }>,
): string => {
  const originUrl = gitOutput(run, {
    cwd: placement.repositoryRoot,
    handed: ["config", "--get", "remote.origin.url"],
  });
  const location = worktreeLocationOf({ home: placement.home, name: placement.name, originUrl });
  if (location === undefined) {
    throw new Error(
      `worktree-home: cannot place worktree ${placement.name} for origin ${originUrl} under ${placement.home}/worktrees`,
    );
  }
  return location;
};

export const createWorktree = (
  worktreeRequest: Readonly<{ cwd: string; home: string; name: string }>,
  run: GitRunner = runGit,
): string => {
  const repositoryRoot = repositoryRootOf(run, worktreeRequest.cwd);
  if (repositoryRoot === undefined) {
    throw new Error(`worktree-home: ${worktreeRequest.cwd} is not inside a git repository`);
  }
  const location = locationFor(run, { ...worktreeRequest, repositoryRoot });
  gitOutput(run, { cwd: repositoryRoot, handed: ["fetch", "--quiet", "origin"] });
  const base = defaultBranchOf(run, repositoryRoot);
  gitOutput(run, {
    cwd: repositoryRoot,
    handed: ["worktree", "add", "--quiet", "-b", worktreeRequest.name, location, base],
  });
  return location;
};
