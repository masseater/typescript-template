import { Effect } from "effect";

import { gitOutput, repositoryRootOf, runGit, WorktreeHomeFailure, type GitRunner } from "./git.ts";

export const removeWorktree = (
  worktreePath: string,
  run: GitRunner = runGit,
): Effect.Effect<void, WorktreeHomeFailure> =>
  Effect.gen(function* removeRegisteredWorktree() {
    const repositoryRoot = yield* repositoryRootOf(run, worktreePath);
    if (repositoryRoot === undefined) {
      return yield* new WorktreeHomeFailure({
        message: `worktree-home: ${worktreePath} is not a git worktree`,
      });
    }
    yield* gitOutput(run, { cwd: repositoryRoot, handed: ["worktree", "remove", worktreePath] });
  });
