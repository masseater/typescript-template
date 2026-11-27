import { EXIT_FAILURE, env, optionalEnv, run } from "../shared/runner.ts";

const token = optionalEnv("GITHUB_APP_TOKEN");
if (token === undefined) {
  console.log(
    "::error::credentials.masseater.dev issued no GitHub App token; a merge with GITHUB_TOKEN would start no workflow on the default branch",
  );
  process.exit(EXIT_FAILURE);
}

export const repository = env("GITHUB_REPOSITORY");
export const defaultBranch = env("DEFAULT_BRANCH");

export const gh = (args: readonly string[]): readonly string[] =>
  run("gh", args, { env: { GH_TOKEN: token } })
    .split("\n")
    .filter((line) => line !== "");

export const ghText = (args: readonly string[]): string => gh(args).join("\n");

export const requiredChecks = (): ReadonlySet<string> => {
  try {
    return new Set(
      gh([
        "api",
        `repos/${repository}/rules/branches/${defaultBranch}`,
        "--jq",
        ".[] | .parameters.required_status_checks[]?.context",
      ]),
    );
  } catch {
    console.log(`::notice::${repository} has no branch rules; no check gates a merge`);
    return new Set();
  }
};
