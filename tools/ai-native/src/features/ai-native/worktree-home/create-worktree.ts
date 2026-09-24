import { Effect } from "effect";

import { gitOutput, repositoryRootOf, runGit, WorktreeHomeFailure, type GitRunner } from "./git.ts";
import { worktreeLocationOf } from "./worktree-location.ts";

const defaultBranchOf = (
  run: GitRunner,
  repositoryRoot: string,
): Effect.Effect<string, WorktreeHomeFailure> =>
  Effect.gen(function* readDefaultBranch() {
    const remoteHead = yield* run({
      cwd: repositoryRoot,
      handed: ["rev-parse", "--abbrev-ref", "origin/HEAD"],
    });
    if (remoteHead.status === 0) {
      return remoteHead.stdout.trim();
    }
    yield* gitOutput(run, {
      cwd: repositoryRoot,
      handed: ["remote", "set-head", "origin", "--auto"],
    });
    return yield* gitOutput(run, {
      cwd: repositoryRoot,
      handed: ["rev-parse", "--abbrev-ref", "origin/HEAD"],
    });
  });

const locationFor = (
  run: GitRunner,
  placement: Readonly<{ home: string; name: string; repositoryRoot: string }>,
): Effect.Effect<string, WorktreeHomeFailure> =>
  Effect.gen(function* placeWorktree() {
    const originUrl = yield* gitOutput(run, {
      cwd: placement.repositoryRoot,
      handed: ["config", "--get", "remote.origin.url"],
    });
    const location = worktreeLocationOf({ home: placement.home, name: placement.name, originUrl });
    if (location === undefined) {
      return yield* new WorktreeHomeFailure({
        message: `worktree-home: cannot place worktree ${placement.name} for origin ${originUrl} under ${placement.home}/worktrees`,
      });
    }
    return location;
  });

export const createWorktree = (
  worktreeRequest: Readonly<{ cwd: string; home: string; name: string }>,
  run: GitRunner = runGit,
): Effect.Effect<string, WorktreeHomeFailure> =>
  Effect.gen(function* addWorktree() {
    const repositoryRoot = yield* repositoryRootOf(run, worktreeRequest.cwd);
    if (repositoryRoot === undefined) {
      return yield* new WorktreeHomeFailure({
        message: `worktree-home: ${worktreeRequest.cwd} is not inside a git repository`,
      });
    }
    const location = yield* locationFor(run, { ...worktreeRequest, repositoryRoot });
    yield* gitOutput(run, { cwd: repositoryRoot, handed: ["fetch", "--quiet", "origin"] });
    const base = yield* defaultBranchOf(run, repositoryRoot);
    yield* gitOutput(run, {
      cwd: repositoryRoot,
      handed: ["worktree", "add", "--quiet", "-b", worktreeRequest.name, location, base],
    });
    return location;
  });
