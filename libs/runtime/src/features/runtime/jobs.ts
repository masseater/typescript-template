import {
  JobPayload,
  jobInstanceId,
  jobsWorkflowBinding,
  readJobs,
  type JobsBindings,
} from "@repo/config";
import { Effect, Schema } from "effect";

const consumeJobs = (batch: Readonly<MessageBatch>, env: JobsBindings): Promise<void> =>
  Effect.runPromise(
    Effect.gen(function* consume() {
      for (const logMessage of batch.messages) {
        const packet = yield* Schema.decodeUnknownEffect(JobPayload)(logMessage.body);
        yield* Effect.promise(() =>
          env[jobsWorkflowBinding].create({ id: jobInstanceId(packet), params: packet }),
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

export { consumeJobBatch, consumeJobs };
