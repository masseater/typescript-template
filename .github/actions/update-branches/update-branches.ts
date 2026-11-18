import { setTimeout as sleep } from "node:timers/promises";

import { EXIT_FAILURE, env, optionalEnv, run } from "../shared/runner.ts";

interface Check {
  readonly name: string;
  readonly result: string;
  readonly at: string;
}

interface PullRequest {
  readonly number: string;
  readonly enabledAt: string;
  readonly mergeStateStatus: string;
  readonly checks: readonly Check[];
}

const QUEUED = `.[] | select(.autoMergeRequest != null and (.isDraft | not)) | [
  (.number | tostring),
  .autoMergeRequest.enabledAt,
  .mergeStateStatus,
  ([.statusCheckRollup[]
    | {name: (.name // .context), result: (if (.status // "COMPLETED") == "COMPLETED" then (.conclusion // .state // "") else "PENDING" end), at: (.startedAt // .createdAt // "")}]
    | group_by(.name)
    | map((map(select(.result == "PENDING")) | first) // max_by(.at) | "\\(.name)=\\(.result)=\\(.at)")
    | join(","))
] | @tsv`;
const SETTLED = new Set(["BEHIND", "DIRTY"]);
const BROKEN = ["ERROR", "FAILURE", "STARTUP_FAILURE", "TIMED_OUT"] as const;
const BLOCKING = [...BROKEN, "ACTION_REQUIRED", "CANCELLED"] as const;
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
const defaultBranch = env("DEFAULT_BRANCH");
const gh = (args: readonly string[]): readonly string[] =>
  run("gh", args, { env: { GH_TOKEN: token } })
    .split("\n")
    .filter((line) => line !== "");

const required = new Set(
  gh([
    "api",
    `repos/${repository}/rules/branches/${defaultBranch}`,
    "--jq",
    ".[] | .parameters.required_status_checks[]?.context",
  ]),
);

const parseCheck = (entry: string): Check => {
  const [at = "", result = "", ...name] = entry.split("=").toReversed();
  return { name: name.toReversed().join("="), result, at };
};

const parse = (line: string): PullRequest => {
  const [number = "", enabledAt = "", mergeStateStatus = "", checks = ""] = line.split("\t");
  return {
    number,
    enabledAt,
    mergeStateStatus,
    checks: checks
      .split(",")
      .filter((entry) => entry !== "")
      .map((entry) => parseCheck(entry))
      .filter((check) => required.has(check.name)),
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

const namesWith = (checks: readonly Check[], results: readonly string[]): readonly string[] =>
  checks.filter((check) => results.includes(check.result)).map((check) => check.name);

const passing = (pull: PullRequest): boolean => namesWith(pull.checks, BLOCKING).length === NONE;

const ejectReason = (pull: PullRequest): string | undefined => {
  if (pull.mergeStateStatus === "DIRTY") {
    return `it conflicts with \`${defaultBranch}\`. GitHub runs no checks on a conflicting pull request, so it cannot move until the conflict is resolved`;
  }
  const broken = namesWith(
    pull.checks.filter((check) => check.at >= pull.enabledAt),
    BROKEN,
  );
  if (broken.length > NONE) {
    return `a required check failed: ${broken.map((name) => `\`${name}\``).join(", ")}`;
  }
  return undefined;
};

const eject = (pull: PullRequest, reason: string): void => {
  try {
    gh(["pr", "merge", pull.number, "--repo", repository, "--disable-auto"]);
    gh([
      "pr",
      "comment",
      pull.number,
      "--repo",
      repository,
      "--body",
      `Removed from the merge queue because ${reason}. The rest of the queue moves on without this pull request. Fix it on this branch, then turn auto-merge on again (\`gh pr merge --auto --squash\`) to rejoin the queue at the back.`,
    ]);
    console.log(`::warning::Removed #${pull.number} from the queue: ${reason}`);
  } catch {
    console.log(`::warning::Could not remove pull request #${pull.number} from the queue`);
  }
};

const queued = await listQueued(UNKNOWN_RETRIES);
const ejected = new Set(
  queued.flatMap((pull) => {
    const reason = ejectReason(pull);
    if (reason === undefined) {
      return [];
    }
    eject(pull, reason);
    return [pull.number];
  }),
);
const remaining = queued.filter((pull) => !ejected.has(pull.number));
const inFlight = remaining.filter((pull) => !SETTLED.has(pull.mergeStateStatus) && passing(pull));
if (inFlight.length > NONE) {
  console.log(`Waiting for ${inFlight.map((pull) => `#${pull.number}`).join(", ")} to merge`);
  process.exit();
}
const waiting = remaining
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
