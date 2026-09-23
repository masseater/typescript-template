import { JobPayload, type JobsBindings } from "@repo/config";
import { FileStore } from "@repo/runtime";
import { readWorkerConfig } from "@repo/runtime/bindings";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import { CoreRecords } from "./core-records.ts";
import { transcribeJob } from "./transcribe-job.ts";
import { Transcriber } from "./transcriber.ts";

import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

const transcribeStep = {
  retries: { backoff: "exponential", delay: "1 minute", limit: 2 },
  timeout: "30 minutes",
} as const;

function jobLayer(env: unknown) {
  return Layer.unwrap(
    Effect.map(readWorkerConfig(env), (config) =>
      Layer.mergeAll(
        CoreRecords.fromEnvironment(env),
        FileStore.fromEnvironment(env),
        Transcriber.layer(config.AI),
      ),
    ),
  );
}

class Process extends WorkflowEntrypoint<JobsBindings, JobPayload> {
  override run(event: Readonly<WorkflowEvent<JobPayload>>, step: WorkflowStep) {
    const layer = jobLayer(this.env);
    return step.do("transcribe", transcribeStep, () =>
      Effect.runPromise(transcribeJob(event.payload.jobId).pipe(Effect.provide(layer))),
    );
  }
}

export { Process };
