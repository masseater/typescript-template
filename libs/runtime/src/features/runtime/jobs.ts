import {
  JobPayload,
  jobsQueueBinding,
  jobsWorkflowBinding,
  type JobResult,
  type JobsBindings,
} from "@repo/config";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { Effect, Schema } from "effect";

import { JobLookupFailed, JobNotFound } from "./job-failures.ts";

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
          env[jobsWorkflowBinding].create({ id: instanceId(payload), params: payload }),
        );
        message.ack();
      }
    }),
  );
}

const missingInstance = "instance.not_found";

function instanceId(payload: JobPayload): string {
  return `${payload.ownerId}-${payload.jobId}`;
}

const enqueueJob = Effect.fn("jobs.enqueue")(function* enqueueJob(
  env: JobsBindings,
  ownerId: string,
) {
  const payload = { jobId: crypto.randomUUID(), ownerId };
  yield* Effect.promise(() => env[jobsQueueBinding].send(payload));
  return payload;
});

const jobStatus = Effect.fn("jobs.status")(function* jobStatus(
  env: JobsBindings,
  payload: JobPayload,
) {
  const instance = yield* Effect.tryPromise({
    catch: (cause) =>
      cause instanceof Error && cause.message === missingInstance
        ? new JobNotFound()
        : new JobLookupFailed({ cause }),
    try: () => env[jobsWorkflowBinding].get(instanceId(payload)),
  });
  return yield* Effect.promise(() => instance.status());
});

export { Process, consumeJobs, enqueueJob, jobStatus };
