import { env as processEnvironment } from "node:process";

import { spawnChildSync } from "../node-spawn.ts";
import { parseOpenPullRequest, type OpenPullRequest } from "./parse-open-pr.ts";

export type CommandLaunch = {
  readonly cwd: string;
  readonly executable: string;
  readonly handed: readonly string[];
};

export type CommandResult = {
  readonly status: number | null;
  readonly stdout: string;
};

export type CommandRunner = (launch: CommandLaunch) => CommandResult;

export const defaultCommandRunner: CommandRunner = (launch) =>
  spawnChildSync({
    executable: launch.executable,
    handed: launch.handed,
    spawnOptions: {
      cwd: launch.cwd,
      encoding: "utf8",
      env: processEnvironment,
    },
  });


export const openPullRequestOf = (
  cwd: string,
  run: CommandRunner = defaultCommandRunner,
): OpenPullRequest | undefined => {
  const result = run({
    cwd,
    executable: "gh",
    handed: ["pr", "view", "--json", "number,url,baseRefName,mergeStateStatus"],
  });
  return result.status === 0 ? parseOpenPullRequest(result.stdout) : undefined;
};
