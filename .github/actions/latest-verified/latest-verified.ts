import { appendTo, env, field, ghJson, stringField } from "../shared/runner.ts";

const token = env("GH_TOKEN");
const repository = env("GITHUB_REPOSITORY");
const verifyJob = env("VERIFY_JOB");
const runNumber = Number(env("GITHUB_RUN_NUMBER"));

const arrayField = (value: unknown, key: string): readonly unknown[] => {
  const found = field(value, key);
  if (!Array.isArray(found)) {
    throw new TypeError(`${key} is not an array`);
  }
  return found;
};

const current = ghJson([`repos/${repository}/actions/runs/${env("GITHUB_RUN_ID")}`], token);
const workflow = String(field(current, "workflow_id"));
const branch = encodeURIComponent(env("GITHUB_REF_NAME"));
const runs = ghJson(
  [
    `repos/${repository}/actions/workflows/${workflow}/runs?branch=${branch}&event=push&per_page=100`,
  ],
  token,
);
const newer = arrayField(runs, "workflow_runs").filter(
  (candidate) => Number(field(candidate, "run_number")) > runNumber,
);
const jobsOf = (run: unknown): readonly unknown[] => {
  const id = String(field(run, "id"));
  return arrayField(
    ghJson([`repos/${repository}/actions/runs/${id}/jobs?per_page=100`], token),
    "jobs",
  );
};
const passed = (run: unknown): boolean =>
  jobsOf(run).some(
    (job) => stringField(job, "name") === verifyJob && field(job, "conclusion") === "success",
  );
const superseding = newer.find((run) => passed(run));
if (superseding === undefined) {
  appendTo("GITHUB_OUTPUT", { latest: "true" });
} else {
  console.log(
    `run ${String(field(superseding, "id"))} of a newer push passed ${verifyJob} and supersedes this one`,
  );
}
