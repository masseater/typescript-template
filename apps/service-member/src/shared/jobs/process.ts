import { type JobPayload, type JobResult, type JobsBindings } from "@repo/config";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { Effect } from "effect";

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

export { Process };
