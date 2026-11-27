import { env } from "../shared/runner.ts";
import { defaultBranch, gh, repository } from "./context.ts";

const RECENT_RUNS = "10";
const RED: ReadonlySet<string> = new Set(["failure", "startup_failure", "timed_out"]);

const verifyWorkflow = env("VERIFY_WORKFLOW");
const verifyJob = env("VERIFY_JOB");

const settledVerify = (runId: string): string | undefined => {
  const [latest] = gh([
    "api",
    `repos/${repository}/actions/runs/${runId}/jobs?per_page=100`,
    "--jq",
    `.jobs[] | select(.name == ${JSON.stringify(verifyJob)} and .status == "completed" and .conclusion != "cancelled" and .conclusion != "skipped") | "\\(.conclusion)\t\\(.html_url)"`,
  ]);
  return latest;
};

export const redVerify = (): string | undefined => {
  try {
    const runs = gh([
      "api",
      `repos/${repository}/actions/workflows/${verifyWorkflow}/runs?branch=${defaultBranch}&per_page=${RECENT_RUNS}`,
      "--jq",
      ".workflow_runs[].id",
    ]);
    const latest = runs.map((runId) => settledVerify(runId)).find((job) => job !== undefined) ?? "";
    const [conclusion = "", url = ""] = latest.split("\t");
    if (RED.has(conclusion)) {
      return url;
    }
    return undefined;
  } catch {
    console.log(`::notice::No ${verifyJob} result on ${defaultBranch} to read`);
    return undefined;
  }
};

export const verifyName = verifyWorkflow;
