import { Effect, Predicate, Schema } from "effect";

import { ConfigurationInvalid } from "./configuration-invalid.ts";

const jobsQueueBinding = "JOBS";
const jobsWorkflowBinding = "PROCESS";
const jobsWorkflowClass = "Process";
const jobsQueueName = "jobs";
const jobsWorkflowName = "Process";

const JobPayload = Schema.Struct({
  jobId: Schema.String.check(Schema.isMinLength(1)),
});

type JobPayload = typeof JobPayload.Type;

type JobResult = {
  readonly jobId: string;
  readonly stage: "complete";
};

type JobQueue = {
  readonly send: (message: JobPayload) => Promise<unknown>;
};

type JobWorkflow = {
  readonly create: (options: {
    readonly id?: string;
    readonly params?: JobPayload;
  }) => Promise<{ readonly id: string }>;
  readonly get: (id: string) => Promise<{
    readonly status: () => Promise<{
      readonly status: string;
      readonly output?: unknown;
      readonly error?: { readonly message: string } | null;
    }>;
  }>;
};

const bindingWith = <Binding>(
  bindingName: string,
  methods: readonly string[],
): Schema.declare<Binding, Binding> =>
  Schema.declare(
    (candidate: unknown): candidate is Binding =>
      Predicate.isObject(candidate) &&
      methods.every((method) => typeof Reflect.get(candidate, method) === "function"),
    { expected: bindingName },
  );

const JobsBindings = Schema.Struct({
  [jobsQueueBinding]: bindingWith<JobQueue>("Queue", ["send"]),
  [jobsWorkflowBinding]: bindingWith<JobWorkflow>("Workflow", ["create", "get"]),
});

type JobsBindings = typeof JobsBindings.Type;

const invalid = (reason: string): ConfigurationInvalid => new ConfigurationInvalid({ reason });

const readJobs = Effect.fn("readJobs")(function* readJobs(input: unknown) {
  return yield* Schema.decodeUnknownEffect(JobsBindings)(input).pipe(
    Effect.mapError((issue) => invalid(issue.message)),
  );
});

export {
  JobPayload,
  jobsQueueBinding,
  jobsQueueName,
  jobsWorkflowBinding,
  jobsWorkflowClass,
  jobsWorkflowName,
  readJobs,
};
export type { JobResult, JobsBindings };
