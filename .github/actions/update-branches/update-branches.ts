import { setTimeout as sleep } from "node:timers/promises";

import { EXIT_FAILURE, env, optionalEnv, run } from "../shared/runner.ts";

interface Check {
  readonly name: string;
  readonly result: string;
  readonly at: string;
}

interface PullRequest {
  readonly number: string;
  readonly head: string;
  readonly enabledAt: string;
  readonly mergeStateStatus: string;
  readonly bot: boolean;
  readonly checks: readonly Check[];
}

const OPEN = `.[] | select(.isDraft | not) | [
  (.number | tostring),
  .headRefOid,
  (.autoMergeRequest.enabledAt // ""),
  .mergeStateStatus,
  (.author.is_bot | tostring),
  ([.statusCheckRollup[]
    | {name: (.name // .context), result: (if (.status // "COMPLETED") == "COMPLETED" then (.conclusion // .state // "") else "PENDING" end), at: (.startedAt // .createdAt // "")}]
    | group_by(.name)
    | map((map(select(.result == "PENDING")) | first) // max_by(.at) | "\\(.name)=\\(.result)=\\(.at)")
    | join(","))
] | @tsv`;
const SETTLED = new Set(["BEHIND", "DIRTY"]);
const BROKEN = ["ERROR", "FAILURE", "STARTUP_FAILURE", "TIMED_OUT"] as const;
const BLOCKING = [...BROKEN, "ACTION_REQUIRED", "CANCELLED"] as const;
const RED = new Set(["failure", "startup_failure", "timed_out"]);
const LATEST_VERIFY = `[.workflow_runs[] | select(.conclusion != "cancelled" and .conclusion != "skipped")][0] // {} | "\\(.conclusion // "")\t\\(.html_url // "")"`;
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
const verifyWorkflow = env("VERIFY_WORKFLOW");
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
  const [number = "", head = "", enabledAt = "", mergeStateStatus = "", bot = "", checks = ""] =
    line.split("\t");
  return {
    number,
    head,
    enabledAt,
    mergeStateStatus,
    bot: bot === "true",
    checks: checks
      .split(",")
      .filter((entry) => entry !== "")
      .map((entry) => parseCheck(entry))
      .filter((check) => required.has(check.name)),
  };
};

const listOpen = async (retries: number): Promise<readonly PullRequest[]> => {
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
    "number,isDraft,headRefOid,mergeStateStatus,autoMergeRequest,statusCheckRollup",
    "--jq",
    OPEN,
  ]).map((line) => parse(line));
  if (retries > NONE && pulls.some((pull) => pull.mergeStateStatus === "UNKNOWN")) {
    await sleep(RETRY_DELAY_MS);
    return listOpen(retries - ONE);
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

const comment = (pull: PullRequest, body: string): void => {
  gh(["pr", "comment", pull.number, "--repo", repository, "--body", body]);
};

const marker = (pull: PullRequest): string =>
  `<!-- update-branches:${pull.mergeStateStatus}:${pull.head} -->`;

const reportConflict = (pull: PullRequest): void => {
  try {
    const bodies = gh([
      "api",
      "--paginate",
      `repos/${repository}/issues/${pull.number}/comments`,
      "--jq",
      ".[].body",
    ]);
    if (bodies.some((body) => body.includes(marker(pull)))) {
      return;
    }
    comment(
      pull,
      `${marker(pull)}\nThis pull request conflicts with \`${defaultBranch}\`, and it is not in the merge queue because auto-merge is off. GitHub runs no checks on a conflicting pull request, so nothing moves it. Merge \`${defaultBranch}\` into this branch and resolve the conflict, then turn auto-merge on (\`gh pr merge --auto --squash\`) to join the queue.`,
    );
    console.log(`::warning::#${pull.number} conflicts with ${defaultBranch} outside the queue`);
  } catch {
    console.log(`::warning::Could not report the conflict on pull request #${pull.number}`);
  }
};

const eject = (pull: PullRequest, reason: string): void => {
  try {
    gh(["pr", "merge", pull.number, "--repo", repository, "--disable-auto"]);
    comment(
      pull,
      `${marker(pull)}\nRemoved from the merge queue because ${reason}. The rest of the queue moves on without this pull request. Fix it on this branch, then turn auto-merge on again (\`gh pr merge --auto --squash\`) to rejoin the queue at the back.`,
    );
    console.log(`::warning::Removed #${pull.number} from the queue: ${reason}`);
  } catch {
    console.log(`::warning::Could not remove pull request #${pull.number} from the queue`);
  }
};

const redVerify = (): string | undefined => {
  try {
    const [latest = ""] = gh([
      "api",
      `repos/${repository}/actions/workflows/${verifyWorkflow}/runs?branch=${defaultBranch}&status=completed&per_page=20`,
      "--jq",
      LATEST_VERIFY,
    ]);
    const [conclusion = "", url = ""] = latest.split("\t");
    return RED.has(conclusion) ? url : undefined;
  } catch {
    console.log(`::warning::Could not read the latest ${verifyWorkflow} run on ${defaultBranch}`);
    return undefined;
  }
};

const open = await listOpen(UNKNOWN_RETRIES);
for (const pull of open) {
  if (pull.enabledAt === "" && pull.mergeStateStatus === "DIRTY") {
    reportConflict(pull);
  }
}
const queued = open.filter((pull) => pull.enabledAt !== "");
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
const red = redVerify();
if (red !== undefined) {
  console.log(
    `::warning::${verifyWorkflow} is red on ${defaultBranch} (${red}); bot pull requests wait until it passes`,
  );
}
const waiting = remaining
  .filter((pull) => pull.mergeStateStatus === "BEHIND" && passing(pull))
  .filter((pull) => red === undefined || !pull.bot)
  .toSorted((left, right) => left.enabledAt.localeCompare(right.enabledAt));
const next = waiting.find((pull) => {
  try {
    gh(["pr", "update-branch", pull.number, "--repo", repository]);
    return true;
  } catch {
    eject(
      pull,
      `GitHub refused to merge \`${defaultBranch}\` into it (\`gh pr update-branch\` failed; see the update-branches run log for the error)`,
    );
    return false;
  }
});
if (next === undefined) {
  console.log("No queued pull request is behind");
  process.exit();
}
console.log(`Updated #${next.number}; ${String(waiting.length - ONE)} more wait behind it`);
