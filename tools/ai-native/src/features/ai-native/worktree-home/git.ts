import { env as processEnvironment } from "node:process";

import { spawnChildSync } from "../node-spawn.ts";

export type GitRunner = (
  gitLaunch: Readonly<{ cwd: string; handed: readonly string[] }>,
) => Readonly<{ status: number | null; stderr: string; stdout: string }>;

export const runGit: GitRunner = (gitLaunch) =>
  spawnChildSync({
    executable: "git",
    handed: gitLaunch.handed,
    spawnOptions: { cwd: gitLaunch.cwd, encoding: "utf8", env: processEnvironment },
  });

export const gitOutput = (
  run: GitRunner,
  gitLaunch: Readonly<{ cwd: string; handed: readonly string[] }>,
): string => {
  const gitExit = run(gitLaunch);
  if (gitExit.status !== 0) {
    throw new Error(
      `worktree-home: git ${gitLaunch.handed.join(" ")} failed in ${gitLaunch.cwd}: ${gitExit.stderr.trim()}`,
    );
  }
  return gitExit.stdout.trim();
};

export const repositoryRootOf = (run: GitRunner, directory: string): string | undefined => {
  const commonDirectory = run({
    cwd: directory,
    handed: ["rev-parse", "--path-format=absolute", "--git-common-dir"],
  });
  if (commonDirectory.status !== 0) {
    return undefined;
  }
  const gitDirectory = commonDirectory.stdout.trim();
  return gitDirectory.endsWith("/.git") ? gitDirectory.slice(0, -"/.git".length) : undefined;
};
