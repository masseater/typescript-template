import { JobPayload, readJobs, httpStatus } from "@repo/config";

import { unavailable } from "@repo/runtime/account";
import { createApi } from "@repo/runtime/http";
import { enqueueJob, jobStatus } from "@repo/runtime/jobs";
import { env } from "cloudflare:workers";
import { Effect, Schema } from "effect";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const JobAccepted = Schema.Struct({
  id: Schema.String,
});

const JobStatusView = Schema.Struct({
  id: Schema.String,
  status: Schema.String,
  output: Schema.optionalKey(Schema.Unknown),
  error: Schema.optionalKey(Schema.NullOr(Schema.Struct({ message: Schema.String }))),
});

const failures = {
  ...unavailable,
  ConfigurationInvalid: "unexpected" as const,
  InputInvalid: { message: "入力内容を確認してください。", status: httpStatus.badRequest },
};

function jobsApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .post(
      "/jobs",
      api.route(
        JobAccepted,
        () =>
          Effect.gen(function* handleRequest() {
            const jobs = yield* readJobs(env);
            const { jobId } = yield* enqueueJob(jobs);
            return { id: jobId };
          }),
        failures,
      ),
    )
    .get(
      "/jobs/:id",
      api.route(
        JobStatusView,
        (request) =>
          Effect.gen(function* handleRequest() {
            const id = new URL(request.url).pathname.split("/").at(-1) ?? "";
            yield* Schema.decodeEffect(JobPayload)({ jobId: id }).pipe(
              Effect.mapError(() => ({ _tag: "InputInvalid" as const })),
            );
            const jobs = yield* readJobs(env);
            const status = yield* jobStatus(jobs, id);
            return {
              id,
              status: status.status,
              ...(status.output === undefined ? {} : { output: status.output }),
              ...(status.error === undefined ? {} : { error: status.error }),
            };
          }),
        failures,
      ),
    );
}

export { jobsApi };
