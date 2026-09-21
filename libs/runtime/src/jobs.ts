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
    logEvent: Readonly<{
      payload: JobPayload;
    }>,
    step: {
      do: <Value>(spelled: string, work: () => Promise<Value>) => Promise<Value>;
    },
  ): Promise<JobResult> {
    const prepared = await step.do("prepare", () =>
      Promise.resolve({
        jobId: logEvent.payload.jobId,
        stage: "prepared" as const,
      }),
    );
    const executed = await step.do("execute", () =>
      Promise.resolve({
        ...prepared,
        stage: "executed" as const,
      }),
    );
    return step.do("finalize", () =>
      Promise.resolve({
        jobId: executed.jobId,
        stage: "complete" as const,
      }),
    );
  }
}
const consumeJobs = async (batch: MessageBatch<unknown>, env: JobsBindings): Promise<void> => {
  for (const logMessage of batch.messages) {
    const packet = Schema.decodeUnknownSync(JobPayload)(logMessage.body);
    await env[jobsWorkflowBinding].create({ id: packet.jobId, params: packet });
    logMessage.ack();
  }
};
const enqueueJob = Effect.fn("jobs.enqueue")(function* enqueueJob(env: JobsBindings) {
  const jobId = crypto.randomUUID();
  const packet = { jobId };
  yield* Effect.promise(() => env[jobsQueueBinding].send(packet));
  return packet;
});
const jobStatus = Effect.fn("jobs.status")(function* jobStatus(env: JobsBindings, jobId: string) {
  const runtimeInstance = yield* Effect.promise(() => env[jobsWorkflowBinding].get(jobId));
  return yield* Effect.promise(() => runtimeInstance.status());
});
export { Process, consumeJobs, enqueueJob, jobStatus };
