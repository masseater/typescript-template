import { env as processEnvironment } from "node:process";

import { spawnChildSync } from "../node-spawn.ts";
import { parseOpenPullRequest, type OpenPullRequest } from "./parse-open-pr.ts";

export type CommandRunner = (commandLaunch: {
  readonly cwd: string;
  readonly executable: string;
  readonly handed: readonly string[];
}) => {
  readonly status: number | null;
  readonly stdout: string;
};

const defaultCommandRunner: CommandRunner = (commandLaunch) =>
  spawnChildSync({
    executable: commandLaunch.executable,
    handed: commandLaunch.handed,
    spawnOptions: {
      cwd: commandLaunch.cwd,
      encoding: "utf8",
      env: processEnvironment,
    },
  });

export const openPullRequestOf = (
  cwd: string,
  run: CommandRunner = defaultCommandRunner,
): OpenPullRequest | undefined => {
  const prViewExit = run({
    cwd,
    executable: "gh",
    handed: ["pr", "view", "--json", "number,url,baseRefName,mergeStateStatus"],
  });
  return prViewExit.status === 0 ? parseOpenPullRequest(prViewExit.stdout) : undefined;
};
