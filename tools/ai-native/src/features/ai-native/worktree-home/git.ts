import { Data, Effect } from "effect";

import { runCaptured } from "../child-process.ts";

export type GitRunner = (
  gitLaunch: Readonly<{ cwd: string; handed: readonly string[] }>,
) => Effect.Effect<Readonly<{ status: number | null; stderr: string; stdout: string }>>;

export const runGit: GitRunner = (gitLaunch) =>
  runCaptured({ executable: "git", handed: gitLaunch.handed, cwd: gitLaunch.cwd });

export class WorktreeHomeFailure extends Data.TaggedError("WorktreeHomeFailure")<{
  readonly message: string;
}> {}

export const gitOutput = (
  run: GitRunner,
  gitLaunch: Readonly<{ cwd: string; handed: readonly string[] }>,
): Effect.Effect<string, WorktreeHomeFailure> =>
  run(gitLaunch).pipe(
    Effect.flatMap((gitExit) =>
      gitExit.status === 0
        ? Effect.succeed(gitExit.stdout.trim())
        : Effect.fail(
            new WorktreeHomeFailure({
              message: `worktree-home: git ${gitLaunch.handed.join(" ")} failed in ${gitLaunch.cwd}: ${gitExit.stderr.trim()}`,
            }),
          ),
    ),
  );

export const repositoryRootOf = (
  run: GitRunner,
  directory: string,
): Effect.Effect<string | undefined> =>
  run({
    cwd: directory,
    handed: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  }).pipe(
    Effect.map((commonDirectory) => {
      if (commonDirectory.status !== 0) {
        return undefined;
      }
      const gitDirectory = commonDirectory.stdout.trim();
      return gitDirectory.endsWith("/.git") ? gitDirectory.slice(0, -"/.git".length) : undefined;
    }),
  );
