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
import { DateTime, Effect, Layer, Schema } from "effect";

import { jobsApi } from "./jobs-api.ts";

declare global {
  // oxlint-disable-next-line typescript/no-namespace
  namespace Cloudflare {
    interface Env {
      readonly PROCESS: Workflow;
    }
  }
}

const routes = {
  "/api/jobs": "jobs-api",
  "/api/jobs/*": "jobs-api",
};
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;

function jobsApp() {
  const environment = appEnvironment();
  const runtime = workerRuntime(() =>
    Layer.orDie(appLayer({ env: environment, audience: APPLICATION.user, routes: routes })),
  );
  return createApi(apiRoot).use(jobsApi(apiRoutes(runtime, reporting)));
}

it.effect("enqueues a job, runs the workflow steps, and reports completion", () =>
  Effect.gen(function* program() {
    const jobs = yield* readJobs(env);
    const app = jobsApp();
    const created = yield* Effect.promise(() =>
      Promise.resolve(
        app.fetch(
          new Request(`${fixtureOrigin}${apiRoot}/jobs`, {
            headers: { origin: fixtureOrigin },
            method: "POST",
          }),
        ),
      ),
    );
    assert.strictEqual(created.status, httpStatus.ok);
    const body = yield* Schema.decodeEffect(
      Schema.fromJsonString(Schema.Struct({ id: Schema.String })),
    )(yield* Effect.promise(() => created.text()));
    yield* Schema.decodeEffect(JobPayload)({ jobId: body.id });

    const instance = yield* Effect.promise(() =>
      introspectWorkflowInstance(env[jobsWorkflowBinding], body.id),
    );
    const view = yield* Effect.gen(function* observe() {
      yield* Effect.promise(() =>
        instance.modify((modifier: { readonly disableSleeps: () => Promise<void> }) =>
          modifier.disableSleeps(),
        ),
      );

      const batch = createMessageBatch(jobsQueueName, [
        {
          attempts: 1,
          body: { jobId: body.id },
          id: body.id,
          timestamp: DateTime.toDate(DateTime.nowUnsafe()),
        },
      ]);
      const context = createExecutionContext();
      yield* Effect.promise(() => consumeJobs(batch, jobs));
      const queueResult = yield* Effect.promise(() => getQueueResult(batch, context));
      assert.deepStrictEqual(queueResult.explicitAcks, [body.id]);

      yield* Effect.promise(() => instance.waitForStatus("complete"));
      const output = yield* Effect.promise(() => instance.getOutput());
      assert.deepStrictEqual(output, { jobId: body.id, stage: "complete" });

      const statusResponse = yield* Effect.promise(() =>
        Promise.resolve(app.fetch(new Request(`${fixtureOrigin}${apiRoot}/jobs/${body.id}`))),
      );
      assert.strictEqual(statusResponse.status, httpStatus.ok);
      return yield* Schema.decodeEffect(Schema.fromJsonString(Schema.Unknown))(
        yield* Effect.promise(() => statusResponse.text()),
      );
    }).pipe(Effect.ensuring(Effect.promise(() => instance.dispose())));

    assert.deepStrictEqual(view, {
      id: body.id,
      output: { jobId: body.id, stage: "complete" },
      status: "complete",
    });
  }),
);
