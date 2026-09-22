import {
  JobPayload,
  jobsQueueBinding,
  jobsWorkflowBinding,
  type JobResult,
  type JobsBindings,
} from "@repo/config";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { Crypto, Effect, Schema } from "effect";
class Process extends WorkflowEntrypoint<JobsBindings, JobPayload> {
  override run(
    logEvent: Readonly<{
      payload: JobPayload;
    }>,
    step: Readonly<{
      do: <Value>(spelled: string, work: () => Promise<Value>) => Promise<Value>;
    }>,
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
const consumeJobs = (batch: Readonly<MessageBatch>, env: JobsBindings): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* consume() {
      for (const logMessage of batch.messages) {
        const packet = yield* Schema.decodeUnknownEffect(JobPayload)(logMessage.body);
        yield* Effect.promise(() =>
          env[jobsWorkflowBinding].create({ id: packet.jobId, params: packet }),
        );
        logMessage.ack();
      }
    }),
  );
const jobsCrypto = Crypto.make({
  digest: (algorithmName, digestInput) =>
    Effect.tryPromise(() => crypto.subtle.digest(algorithmName, Uint8Array.from(digestInput))).pipe(
      Effect.map((digestBytes) => new Uint8Array(digestBytes)),
      Effect.orDie,
    ),
  randomBytes: (byteCount) => crypto.getRandomValues(new Uint8Array(byteCount)),
});
const enqueueJob = Effect.fn("jobs.enqueue")(function* enqueueJob(env: JobsBindings) {
  const jobId = yield* jobsCrypto.randomUUIDv4.pipe(Effect.orDie);
  const packet = { jobId };
  yield* Effect.promise(() => env[jobsQueueBinding].send(packet));
  return packet;
});
const jobStatus = Effect.fn("jobs.status")(function* jobStatus(env: JobsBindings, jobId: string) {
  const runtimeInstance = yield* Effect.promise(() => env[jobsWorkflowBinding].get(jobId));
  return yield* Effect.promise(() => runtimeInstance.status());
});
export { Process, consumeJobs, enqueueJob, jobStatus };
