import {
  JobPayload,
  JobResult,
  jobsQueueBinding,
  jobsWorkflowBinding,
  readJobs,
  type JobsBindings,
  webCrypto,
} from "@repo/config";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { Effect, Schema } from "effect";

import { JobLookupFailed } from "./job-lookup-failed.ts";
import { JobNotFound } from "./job-not-found.ts";

import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

class Process extends WorkflowEntrypoint<JobsBindings, JobPayload> {
  override run(
    logEvent: Readonly<WorkflowEvent<JobPayload>>,
    step: WorkflowStep,
  ): Promise<JobResult> {
    return Effect.runPromise(
      Effect.gen(function* processJob() {
        const prepared = yield* Effect.promise(() =>
          step.do("prepare", () =>
            Promise.resolve({
              jobId: logEvent.payload.jobId,
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
const missingInstance = "instance.not_found";
const instanceId = (packet: JobPayload): string => `${packet.ownerId}-${packet.jobId}`;
const consumeJobs = (batch: Readonly<MessageBatch>, env: JobsBindings): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* consume() {
      for (const logMessage of batch.messages) {
        const packet = yield* Schema.decodeUnknownEffect(JobPayload)(logMessage.body);
        yield* Effect.promise(() =>
          env[jobsWorkflowBinding].create({ id: instanceId(packet), params: packet }),
        );
        logMessage.ack();
      }
    }),
  );
const consumeJobBatch = (batch: Readonly<MessageBatch>, environment: unknown): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* consumeBatch() {
      const jobs = yield* readJobs(environment);
      yield* Effect.promise(() => consumeJobs(batch, jobs));
    }).pipe(Effect.orDie),
  );
const enqueueJob = Effect.fn("jobs.enqueue")(function* enqueueJob(
  env: JobsBindings,
  ownerId: string,
) {
  const jobId = yield* webCrypto.randomUUIDv4.pipe(Effect.orDie);
  const packet = { jobId, ownerId };
  yield* Effect.promise(() => env[jobsQueueBinding].send(packet));
  return packet;
});
const jobStatus = Effect.fn("jobs.status")(function* jobStatus(
  env: JobsBindings,
  packet: JobPayload,
) {
  const runtimeInstance = yield* Effect.tryPromise({
    catch: (cause) =>
      cause instanceof Error && cause.message === missingInstance
        ? new JobNotFound()
        : new JobLookupFailed({ cause }),
    try: () => env[jobsWorkflowBinding].get(instanceId(packet)),
  });
  const reported = yield* Effect.promise(() => runtimeInstance.status());
  const output =
    reported.output === undefined
      ? undefined
      : yield* Schema.decodeUnknownEffect(JobResult)(reported.output).pipe(
          Effect.mapError((cause) => new JobLookupFailed({ cause })),
        );
  return {
    status: reported.status,
    ...(output === undefined ? {} : { output }),
    ...(reported.error === undefined ? {} : { error: reported.error }),
  };
});
export { Process, consumeJobBatch, consumeJobs, enqueueJob, jobStatus };
