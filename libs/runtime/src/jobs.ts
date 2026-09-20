import {
  JobPayload,
  jobsQueueBinding,
  jobsWorkflowBinding,
  type JobResult,
  type JobsBindings,
} from "@repo/config";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { Effect, Schema } from "effect";

class Process extends WorkflowEntrypoint<JobsBindings, JobPayload> {
  override async run(
    event: Readonly<{ payload: JobPayload }>,
    step: {
      do: <Value>(name: string, work: () => Promise<Value>) => Promise<Value>;
    },
  ): Promise<JobResult> {
    const prepared = await step.do("prepare", async () => ({
      jobId: event.payload.jobId,
      stage: "prepared" as const,
    }));
    const executed = await step.do("execute", async () => ({
      ...prepared,
      stage: "executed" as const,
    }));
    return step.do("finalize", async () => ({
      jobId: executed.jobId,
      stage: "complete" as const,
    }));
  }
}

async function consumeJobs(batch: MessageBatch<unknown>, env: JobsBindings): Promise<void> {
  for (const message of batch.messages) {
    const payload = Schema.decodeUnknownSync(JobPayload)(message.body);
    await env[jobsWorkflowBinding].create({ id: payload.jobId, params: payload });
    message.ack();
  }
}

const enqueueJob = Effect.fn("jobs.enqueue")(function* enqueueJob(env: JobsBindings) {
  const jobId = crypto.randomUUID();
  const payload = { jobId };
  yield* Effect.promise(async () => env[jobsQueueBinding].send(payload));
  return payload;
});

const jobStatus = Effect.fn("jobs.status")(function* jobStatus(
  env: JobsBindings,
  jobId: string,
) {
  const instance = yield* Effect.promise(async () => env[jobsWorkflowBinding].get(jobId));
  return yield* Effect.promise(async () => instance.status());
});

export { Process, consumeJobs, enqueueJob, jobStatus };
