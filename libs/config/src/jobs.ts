import { Effect, Schema } from "effect";

import { bindingWith, decode } from "./environment.ts";

const jobsQueueBinding = "JOBS";
const jobsWorkflowBinding = "PROCESS";
const jobsWorkflowClass = "Process";
const jobsQueueName = "jobs";
const jobsWorkflowName = "Process";

const JobPayload = Schema.Struct({
  jobId: Schema.String.check(Schema.isMinLength(1)),
});

type JobPayload = typeof JobPayload.Type;

type JobResult = {
  readonly jobId: string;
  readonly stage: "complete";
};

type JobQueue = {
  readonly send: (message: JobPayload) => Promise<unknown>;
};

type JobWorkflow = {
  readonly create: (options: {
    readonly id?: string;
    readonly params?: JobPayload;
  }) => Promise<{ readonly id: string }>;
  readonly get: (id: string) => Promise<{
    readonly status: () => Promise<{
      readonly status: string;
      readonly output?: unknown;
      readonly error?: { readonly message: string } | null;
    }>;
  }>;
};

const JobsBindings = Schema.Struct({
  [jobsQueueBinding]: bindingWith<JobQueue>("Queue", ["send"]),
  [jobsWorkflowBinding]: bindingWith<JobWorkflow>("Workflow", ["create", "get"]),
});

type JobsBindings = typeof JobsBindings.Type;

const readJobs = Effect.fn("readJobs")(function* readJobs(input: unknown) {
  return yield* decode(JobsBindings, input);
});

export {
  JobPayload,
  jobsQueueBinding,
  jobsQueueName,
  jobsWorkflowBinding,
  jobsWorkflowClass,
  jobsWorkflowName,
  readJobs,
};
export type { JobResult, JobsBindings };
