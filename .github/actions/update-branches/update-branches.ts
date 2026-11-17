import { setTimeout as sleep } from "node:timers/promises";

import { EXIT_FAILURE, env, optionalEnv, run } from "../shared/runner.ts";

interface PullRequest {
  readonly number: string;
  readonly enabledAt: string;
  readonly mergeStateStatus: string;
  readonly failedChecks: readonly string[];
}

const QUEUED = `.[] | select(.autoMergeRequest != null and (.isDraft | not)) | [
  (.number | tostring),
  .autoMergeRequest.enabledAt,
  .mergeStateStatus,
  ([.statusCheckRollup[]
    | {name: (.name // .context), result: (.conclusion // .state), at: (.startedAt // .createdAt // "")}]
    | group_by(.name)
    | map(max_by(.at))
    | map(select(.result as $result
      | ["ACTION_REQUIRED", "CANCELLED", "ERROR", "FAILURE", "STARTUP_FAILURE", "TIMED_OUT"]
      | index($result)) | .name)
    | join(","))
] | @tsv`;
const SETTLED = new Set(["BEHIND", "DIRTY"]);
const UNKNOWN_RETRIES = 6;
const RETRY_DELAY_MS = 5000;
const NONE = 0;
const ONE = 1;
const LIST_LIMIT = "200";

const token = optionalEnv("GITHUB_APP_TOKEN");
if (token === undefined) {
  console.log(
    "::error::credentials.masseater.dev issued no GitHub App token; an update with GITHUB_TOKEN leaves the up-to-date check waiting for approval",
  );
  process.exit(EXIT_FAILURE);
}
const repository = env("GITHUB_REPOSITORY");
const gh = (args: readonly string[]): readonly string[] =>
  run("gh", args, { env: { GH_TOKEN: token } })
    .split("\n")
    .filter((line) => line !== "");

const required = new Set(
  gh([
    "api",
    `repos/${repository}/rules/branches/${env("DEFAULT_BRANCH")}`,
    "--jq",
    ".[] | .parameters.required_status_checks[]?.context",
  ]),
);

const parse = (line: string): PullRequest => {
  const [number = "", enabledAt = "", mergeStateStatus = "", failedChecks = ""] = line.split("\t");
  return {
    number,
    enabledAt,
    mergeStateStatus,
    failedChecks: failedChecks.split(",").filter((name) => required.has(name)),
  };
};

const listQueued = async (retries: number): Promise<readonly PullRequest[]> => {
  const pulls = gh([
    "pr",
    "list",
    "--repo",
    repository,
    "--state",
    "open",
    "--limit",
    LIST_LIMIT,
    "--json",
    "number,isDraft,mergeStateStatus,autoMergeRequest,statusCheckRollup",
    "--jq",
    QUEUED,
  ]).map((line) => parse(line));
  if (retries > NONE && pulls.some((pull) => pull.mergeStateStatus === "UNKNOWN")) {
    await sleep(RETRY_DELAY_MS);
    return listQueued(retries - ONE);
  }
  return pulls;
};

const passing = (pull: PullRequest): boolean => pull.failedChecks.length === NONE;

const queued = await listQueued(UNKNOWN_RETRIES);
const inFlight = queued.filter((pull) => !SETTLED.has(pull.mergeStateStatus) && passing(pull));
if (inFlight.length > NONE) {
  console.log(`Waiting for ${inFlight.map((pull) => `#${pull.number}`).join(", ")} to merge`);
  process.exit();
}
const waiting = queued
  .filter((pull) => pull.mergeStateStatus === "BEHIND" && passing(pull))
  .toSorted((left, right) => left.enabledAt.localeCompare(right.enabledAt));
const next = waiting.find((pull) => {
  try {
    gh(["pr", "update-branch", pull.number, "--repo", repository]);
    return true;
  } catch {
    console.log(`::warning::Could not update pull request #${pull.number}`);
    return false;
  }
});
if (next === undefined) {
  console.log("No queued pull request is behind");
  process.exit();
}
console.log(`Updated #${next.number}; ${String(waiting.length - ONE)} more wait behind it`);
