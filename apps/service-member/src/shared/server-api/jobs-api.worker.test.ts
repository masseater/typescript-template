import { assert, it } from "@effect/vitest";
import {
  APPLICATION,
  JobPayload,
  httpStatus,
  jobsQueueName,
  jobsWorkflowBinding,
  readJobs,
} from "@repo/config";
import { recordingSink } from "@repo/observability/testing";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { consumeJobs } from "@repo/runtime/jobs";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import {
  createExecutionContext,
  createMessageBatch,
  getQueueResult,
  introspectWorkflowInstance,
} from "cloudflare:test";
import { env } from "cloudflare:workers";
import { Effect, Layer, Schema } from "effect";

import { jobsApi } from "./jobs-api.ts";

const routes = {
  "/api/jobs": "jobs-api",
  "/api/jobs/*": "jobs-api",
};
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;

function jobsApp() {
  const environment = appEnvironment();
  const runtime = workerRuntime(() => Layer.orDie(appLayer(environment, APPLICATION.user, routes)));
  return createApi(apiRoot).use(jobsApi(apiRoutes(runtime, reporting)));
}

it.effect("enqueues a job, runs the workflow steps, and reports completion", () =>
  Effect.gen(function* program() {
    const jobs = yield* readJobs(env);
    const app = jobsApp();
    const created = yield* Effect.promise(async () =>
      app.fetch(
        new Request(`${fixtureOrigin}${apiRoot}/jobs`, {
          headers: { origin: fixtureOrigin },
          method: "POST",
        }),
      ),
    );
    assert.strictEqual(created.status, httpStatus.ok);
    const body = yield* Schema.decodeUnknownEffect(Schema.Struct({ id: Schema.String }))(
      yield* Effect.promise(async () => created.json()),
    );
    yield* Schema.decodeUnknownEffect(JobPayload)({ jobId: body.id });

    const view = yield* Effect.promise(async () => {
      const instance = await introspectWorkflowInstance(env[jobsWorkflowBinding], body.id);
      try {
        await instance.modify(async (modifier) => {
          await modifier.disableSleeps();
        });

        const batch = createMessageBatch(jobsQueueName, [
          { attempts: 1, body: { jobId: body.id }, id: body.id, timestamp: new Date() },
        ]);
        const context = createExecutionContext();
        await consumeJobs(batch, jobs);
        const queueResult = await getQueueResult(batch, context);
        assert.deepStrictEqual(queueResult.explicitAcks, [body.id]);

        await instance.waitForStatus("complete");
        const output = await instance.getOutput();
        assert.deepStrictEqual(output, { jobId: body.id, stage: "complete" });

        const statusResponse = await app.fetch(
          new Request(`${fixtureOrigin}${apiRoot}/jobs/${body.id}`),
        );
        assert.strictEqual(statusResponse.status, httpStatus.ok);
        return statusResponse.json();
      } finally {
        await instance.dispose();
      }
    });

    assert.deepStrictEqual(view, {
      id: body.id,
      output: { jobId: body.id, stage: "complete" },
      status: "complete",
    });
  }),
);
