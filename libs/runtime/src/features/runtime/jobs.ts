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
  override run(
    event: Readonly<{ payload: JobPayload }>,
    step: {
      do: <Value>(name: string, work: () => Promise<Value>) => Promise<Value>;
    },
  ): Promise<JobResult> {
    return Effect.runPromise(
      Effect.gen(function* processJob() {
        const prepared = yield* Effect.promise(() =>
          step.do("prepare", () =>
            Promise.resolve({
              jobId: event.payload.jobId,
              stage: "prepared" as const,
            }),
          ),
        );
        const executed = yield* Effect.promise(() =>
          step.do("execute", () =>
            Promise.resolve({
              ...prepared,
              stage: "executed" as const,
            }),
          ),
        );
        return yield* Effect.promise(() =>
          step.do("finalize", () =>
            Promise.resolve({
              jobId: executed.jobId,
              stage: "complete" as const,
            }),
          ),
        );
      }),
    );
  }
}

function consumeJobs(batch: MessageBatch<unknown>, env: JobsBindings): Promise<void> {
  return Effect.runPromise(
    Effect.gen(function* consume() {
      for (const message of batch.messages) {
        const payload = yield* Schema.decodeUnknownEffect(JobPayload)(message.body);
        yield* Effect.promise(() =>
          env[jobsWorkflowBinding].create({ id: payload.jobId, params: payload }),
        );
        message.ack();
      }
    }),
  );
}

const enqueueJob = Effect.fn("jobs.enqueue")(function* enqueueJob(env: JobsBindings) {
  const jobId = crypto.randomUUID();
  const payload = { jobId };
  yield* Effect.promise(() => env[jobsQueueBinding].send(payload));
  return payload;
});

const jobStatus = Effect.fn("jobs.status")(function* jobStatus(env: JobsBindings, jobId: string) {
  const instance = yield* Effect.promise(() => env[jobsWorkflowBinding].get(jobId));
  return yield* Effect.promise(() => instance.status());
});

export { Process, consumeJobs, enqueueJob, jobStatus };
