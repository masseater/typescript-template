import { EXIT_FAILURE, optionalEnv, env, run } from "../shared/runner.ts";

const token = optionalEnv("GITHUB_APP_TOKEN");
if (token === undefined) {
  console.log(
    "::error::credentials.masseater.dev issued no GitHub App token; an update with GITHUB_TOKEN leaves the up-to-date check waiting for approval",
  );
  process.exit(EXIT_FAILURE);
}
const repository = env("GITHUB_REPOSITORY");
const behind = run(
  "gh",
  [
    "pr",
    "list",
    "--repo",
    repository,
    "--state",
    "open",
    "--json",
    "number,autoMergeRequest,mergeStateStatus",
    "--jq",
    '.[] | select(.autoMergeRequest != null and .mergeStateStatus == "BEHIND") | .number',
  ],
  { env: { GH_TOKEN: token } },
)
  .split("\n")
  .filter((number) => number !== "");
for (const number of behind) {
  try {
    run("gh", ["pr", "update-branch", number, "--repo", repository], { env: { GH_TOKEN: token } });
  } catch {
    console.log(`::warning::Could not update pull request #${number}`);
  }
}
