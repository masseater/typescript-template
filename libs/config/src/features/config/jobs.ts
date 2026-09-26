import { Effect, Schema } from "effect";

import { bindingWith, decode } from "./environment.ts";

import type { Queue, Workflow } from "@cloudflare/workers-types";

const jobsQueueBinding = "JOBS";
const jobsWorkflowBinding = "PROCESS";
const jobsWorkflowClass = "Process";
const jobsQueueName = "jobs";
const jobsWorkflowName = "Process";

const JobPayload = Schema.Struct({
  jobId: Schema.String.check(Schema.isMinLength(1)),
  ownerId: Schema.String.check(Schema.isMinLength(1)),
});

type JobPayload = typeof JobPayload.Type;

const JobResult = Schema.Struct({
  jobId: JobPayload.fields.jobId,
  stage: Schema.Literal("complete"),
});

type JobResult = typeof JobResult.Type;

const JobsBindings = Schema.Struct({
  [jobsQueueBinding]: bindingWith<Queue<JobPayload>>("Queue", ["send"]),
  [jobsWorkflowBinding]: bindingWith<Workflow<JobPayload>>("Workflow", ["create", "get"]),
});

type JobsBindings = typeof JobsBindings.Type;

const readJobs = Effect.fn("readJobs")(function* readJobs(input: unknown) {
  return yield* decode(JobsBindings, input);
});

export {
  JobPayload,
  JobResult,
  jobsQueueBinding,
  jobsQueueName,
  jobsWorkflowBinding,
  jobsWorkflowClass,
  jobsWorkflowName,
  readJobs,
};
export type { JobResult, JobsBindings };
