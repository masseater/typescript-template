import { verifySession } from "@repo/auth";
import { JobPayload, readJobs, httpStatus } from "@repo/config";
import { unavailable } from "@repo/runtime/account";
import { createApi, readJsonBody } from "@repo/runtime/http";
import { enqueueJob, jobStatus } from "@repo/runtime/jobs";
import { env } from "cloudflare:workers";
import { Effect, Schema } from "effect";

import type { AppServices } from "@repo/runtime";
import type { ApiRoutes } from "@repo/runtime/http";

const JobCreate = Schema.Struct({});

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
  JobLookupFailed: "unexpected" as const,
  JobNotFound: { message: "ジョブが見つかりません。", status: httpStatus.notFound },
};

function jobsApi(api: ApiRoutes<AppServices>) {
  return createApi("")
    .post(
      "/jobs",
      api.route(
        JobAccepted,
        (request) =>
          Effect.gen(function* handleRequest() {
            const { user } = yield* verifySession(request.headers);
            yield* readJsonBody(JobCreate, request);
            const jobs = yield* readJobs(env);
            const { jobId } = yield* enqueueJob(jobs, user.id);
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
            const { user } = yield* verifySession(request.headers);
            const id = new URL(request.url).pathname.split("/").at(-1) ?? "";
            const payload = yield* Schema.decodeEffect(JobPayload)({
              jobId: id,
              ownerId: user.id,
            }).pipe(Effect.mapError(() => ({ _tag: "InputInvalid" as const })));
            const jobs = yield* readJobs(env);
            const status = yield* jobStatus(jobs, payload);
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
