import { EXIT_FAILURE, env, optionalEnv, run } from "../shared/runner.ts";

const FIX_PREFIX = "claude/fix-verify-";

if (run("git", ["rev-parse", "HEAD"]) === env("HEAD_SHA")) {
  console.log("::error::Claude did not commit a fix");
  process.exit(EXIT_FAILURE);
}
const appToken = optionalEnv("GITHUB_APP_TOKEN");
if (appToken === undefined) {
  console.log(
    "::error::credentials.masseater.dev issued no GitHub App token; a push with GITHUB_TOKEN leaves the up-to-date check waiting for approval",
  );
  process.exit(EXIT_FAILURE);
}
const gh = { env: { GH_TOKEN: appToken } };
const repository = env("GITHUB_REPOSITORY");
const branch = env("BRANCH");
const failedRunUrl = env("FAILED_RUN_URL");
run("gh", ["auth", "setup-git"], gh);
run("git", ["push", "--no-verify", "origin", `HEAD:refs/heads/${branch}`], gh);
if (branch !== env("HEAD_BRANCH")) {
  const superseded = run(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      repository,
      "--state",
      "open",
      "--json",
      "number,headRefName",
      "--jq",
      `.[] | select(.headRefName | startswith("${FIX_PREFIX}")) | .number`,
    ],
    gh,
  )
    .split("\n")
    .filter((number) => number !== "");
  for (const number of superseded) {
    run(
      "gh",
      [
        "pr",
        "close",
        number,
        "--repo",
        repository,
        "--delete-branch",
        "--comment",
        `Superseded by the fix for ${failedRunUrl}`,
      ],
      gh,
    );
  }
  const url = run(
    "gh",
    [
      "pr",
      "create",
      "--base",
      env("DEFAULT_BRANCH"),
      "--head",
      branch,
      "--title",
      run("git", ["log", "-1", "--format=%s"]),
      "--body",
      `Fixes verify failure ${failedRunUrl}`,
    ],
    gh,
  );
  run("gh", ["pr", "merge", url, "--squash", "--auto", "--delete-branch"], gh);
}
