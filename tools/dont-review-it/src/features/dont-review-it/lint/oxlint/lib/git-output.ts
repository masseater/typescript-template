import { attempt, omitBy } from "es-toolkit";

import { capturedStdoutOf } from "../../../platform/synchronous-host.ts";
import { gitExecutablePath } from "../../../repository-checks/index.ts";
import { isEnvironmentFailure } from "./path-failure.ts";

export type GitEnvironment = {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly input?: string;
};

const answeredWithoutValue = (failure: unknown): boolean =>
  typeof failure === "object" &&
  failure !== null &&
  "status" in failure &&
  typeof failure.status === "number";

export const gitOutput = (
  gitArguments: readonly string[],
  environment: GitEnvironment,
): string | null => {
  const repositoryAgnosticEnv = omitBy(environment.env, (_, environmentName) =>
    environmentName.startsWith("GIT_"),
  );
  const [unaskableGit, gitStdout] = attempt<string, Error>(() =>
    capturedStdoutOf({
      command: gitExecutablePath(repositoryAgnosticEnv.PATH),
      commandArguments: gitArguments,
      cwd: environment.cwd,
      env: repositoryAgnosticEnv,
      input: environment.input,
    }),
  );
  if (unaskableGit === null) return gitStdout.trim();

  if (answeredWithoutValue(unaskableGit) || isEnvironmentFailure(unaskableGit)) return null;
  throw new Error(`git ${gitArguments.join(" ")} could not be run`, { cause: unaskableGit });
};
