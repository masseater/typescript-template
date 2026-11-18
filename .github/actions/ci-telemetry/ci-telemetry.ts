import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { env, field, run, stringField } from "../shared/runner.ts";
import type { Span, Step } from "./log-spans.ts";
import { spansOfLog } from "./log-spans.ts";

const JOBS_FILTER = `.jobs[] | select(.completed_at != null) | {id: (.id | tostring), name, conclusion,
  started_at, completed_at, runner_name: (.runner_name // ""), workflow_name, head_sha,
  head_branch: (.head_branch // ""),
  steps: [.steps[]? | select(.started_at != null and .completed_at != null)
    | {name, conclusion, started_at, completed_at}]}`;
const TRACE_ID_LENGTH = 32;
const SPAN_ID_LENGTH = 16;
const ID_START = 0;
const NANOS_PER_MILLI = 1_000_000n;
const STATUS_ERROR = 2;
const STATUS_UNSET = 0;
const KIND_INTERNAL = 1;
const LAST = -1;
const RUN = "run";
const RESULTS: Readonly<Record<string, string>> = {
  cancelled: "cancellation",
  timed_out: "timeout",
};

const repository = env("GITHUB_REPOSITORY");
const runId = env("GITHUB_RUN_ID");
const attempt = env("GITHUB_RUN_ATTEMPT");
const token = env("GH_TOKEN");
const server = env("GITHUB_SERVER_URL");
const runUrl = `${server}/${repository}/actions/runs/${runId}/attempts/${attempt}`;

const idOf = (key: string, length: number): string =>
  createHash("sha256").update(`${runUrl}/${key}`).digest("hex").slice(ID_START, length);

const nanosOf = (time: string): bigint => BigInt(Date.parse(time)) * NANOS_PER_MILLI;

const resultOf = (conclusion: string): string => RESULTS[conclusion] ?? conclusion;

const stepsOf = (job: unknown): readonly Step[] => {
  const steps = field(job, "steps");
  if (!Array.isArray(steps)) {
    return [];
  }
  return steps.map((step: unknown) => ({
    name: stringField(step, "name"),
    conclusion: stringField(step, "conclusion"),
    start: nanosOf(stringField(step, "started_at")),
    end: nanosOf(stringField(step, "completed_at")),
  }));
};

const logOf = (job: unknown): string => {
  const id = stringField(job, "id");
  if (stringField(job, "conclusion") === "skipped") {
    return "";
  }
  try {
    return run("gh", ["api", `repos/${repository}/actions/jobs/${id}/logs`], {
      env: { GH_TOKEN: token },
    });
  } catch {
    console.log(`::notice::job ${id} has no log to read`);
    return "";
  }
};

const spansOfJob = (job: unknown): readonly Span[] => {
  const id = stringField(job, "id");
  const name = stringField(job, "name");
  const conclusion = stringField(job, "conclusion");
  const steps = stepsOf(job);
  const jobSpan: Span = {
    key: `job/${id}`,
    parent: RUN,
    name,
    start: nanosOf(stringField(job, "started_at")),
    end: nanosOf(stringField(job, "completed_at")),
    attributes: {
      "cicd.pipeline.task.name": name,
      "cicd.pipeline.task.run.id": id,
      "cicd.pipeline.task.run.url.full": `${runUrl}/job/${id}`,
      "cicd.pipeline.task.run.result": resultOf(conclusion),
      "cicd.worker.name": stringField(job, "runner_name"),
    },
    failed: conclusion === "failure",
  };
  const stepSpans = steps.map((step, index): Span => ({
    key: `${jobSpan.key}/step/${String(index)}`,
    parent: jobSpan.key,
    name: step.name,
    start: step.start,
    end: step.end,
    attributes: { "github.step.conclusion": step.conclusion },
    failed: step.conclusion === "failure",
  }));
  return [jobSpan, ...stepSpans, ...spansOfLog(jobSpan.key, steps, logOf(job))];
};

const resultOfRun = (spans: readonly Span[]): string => {
  if (spans.some((span) => span.parent === RUN && span.failed)) {
    return "failure";
  }
  return "success";
};

const valueOf = (value: string | number): unknown => {
  if (typeof value === "number") {
    return { intValue: String(value) };
  }
  return { stringValue: value };
};

const attributesOf = (attributes: Readonly<Record<string, string | number>>): readonly unknown[] =>
  Object.entries(attributes).map(([key, value]) => ({ key, value: valueOf(value) }));

const statusOf = (span: Span): number => {
  if (span.failed) {
    return STATUS_ERROR;
  }
  return STATUS_UNSET;
};

const exported = (traceId: string, span: Span): unknown => {
  const body = {
    traceId,
    spanId: idOf(span.key, SPAN_ID_LENGTH),
    name: span.name,
    kind: KIND_INTERNAL,
    startTimeUnixNano: String(span.start),
    endTimeUnixNano: String(span.end),
    attributes: attributesOf(span.attributes),
    status: { code: statusOf(span) },
  };
  if (span.parent === undefined) {
    return body;
  }
  return { ...body, parentSpanId: idOf(span.parent, SPAN_ID_LENGTH) };
};

const jobs = run(
  "gh",
  [
    "api",
    "--paginate",
    `repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs`,
    "--jq",
    JOBS_FILTER,
  ],
  { env: { GH_TOKEN: token } },
)
  .split("\n")
  .filter((line) => line !== "")
  .map((line): unknown => JSON.parse(line));
const [first] = jobs;
if (first === undefined) {
  console.log("::notice::no job of this run has finished, so there is nothing to record");
  process.exit();
}
const jobSpans = jobs.flatMap((job) => spansOfJob(job));
const starts = jobs.map((job) => stringField(job, "started_at")).toSorted();
const ends = jobs.map((job) => stringField(job, "completed_at")).toSorted();
const workflow = stringField(first, "workflow_name");
const result = resultOfRun(jobSpans);
const root: Span = {
  key: RUN,
  parent: undefined,
  name: workflow,
  start: nanosOf(starts.at(ID_START) ?? ""),
  end: nanosOf(ends.at(LAST) ?? ""),
  attributes: { "cicd.pipeline.result": result },
  failed: result === "failure",
};
const traceId = idOf("trace", TRACE_ID_LENGTH);
const resource = attributesOf({
  "service.name": "github-actions",
  "cicd.pipeline.name": workflow,
  "cicd.pipeline.run.id": runId,
  "cicd.pipeline.run.url.full": runUrl,
  "vcs.repository.url.full": `${server}/${repository}`,
  "vcs.ref.head.name": stringField(first, "head_branch"),
  "vcs.ref.head.revision": stringField(first, "head_sha"),
});
const spans = [root, ...jobSpans].map((span) => exported(traceId, span));
const scope = { name: "masseater/typescript-template/ci-telemetry" };
const trace = {
  resourceSpans: [{ resource: { attributes: resource }, scopeSpans: [{ scope, spans }] }],
};
const directory = env("CI_TELEMETRY_FILES");
mkdirSync(directory, { recursive: true });
writeFileSync(path.join(directory, "ci.jsonl"), `${JSON.stringify(trace)}\n`);
console.log(`recorded ${String(jobSpans.length)} spans of ${String(jobs.length)} jobs`);
