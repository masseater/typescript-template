import {
  jobInstanceId,
  jobsQueueBinding,
  jobsWorkflowBinding,
  webCrypto,
  type JobPayload,
  type JobsBindings,
} from "@repo/config";
import { Effect } from "effect";

import { JobLookupFailed } from "./job-lookup-failed.ts";
import { JobNotFound } from "./job-not-found.ts";

const missingInstance = "instance.not_found";
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
    try: () => env[jobsWorkflowBinding].get(jobInstanceId(packet)),
  });
  return yield* Effect.promise(() => runtimeInstance.status());
});

export { enqueueJob, jobStatus };
