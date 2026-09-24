import { Effect } from "effect";

import { runCaptured } from "../child-process.ts";
import { parseOpenPullRequest, type OpenPullRequest } from "./parse-open-pr.ts";

export type CommandRunner = (commandLaunch: {
  readonly cwd: string;
  readonly executable: string;
  readonly handed: readonly string[];
}) => Effect.Effect<{
  readonly status: number | null;
  readonly stdout: string;
}>;

const defaultCommandRunner: CommandRunner = (commandLaunch) =>
  runCaptured({
    executable: commandLaunch.executable,
    handed: commandLaunch.handed,
    cwd: commandLaunch.cwd,
  });

export const openPullRequestOf = (
  cwd: string,
  run: CommandRunner = defaultCommandRunner,
): Effect.Effect<OpenPullRequest | undefined> =>
  run({
    cwd,
    executable: "gh",
    handed: ["pr", "view", "--json", "number,url,baseRefName,mergeStateStatus"],
  }).pipe(
    Effect.map((prViewExit) =>
      prViewExit.status === 0 ? parseOpenPullRequest(prViewExit.stdout) : undefined,
    ),
  );
