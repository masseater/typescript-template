import { assert, describe, it } from "@effect/vitest";
import {
  APPLICATION,
  JobPayload,
  httpStatus,
  jobsQueueName,
  jobsWorkflowBinding,
  readJobs,
} from "@repo/config";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { recordingSink } from "@repo/observability/testing";
import { accountApi } from "@repo/runtime/account";
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
      readonly EMAIL: {
        taken(): Promise<
          ReadonlyArray<{
            readonly from: string;
            readonly subject: string;
            readonly text: string;
            readonly to: readonly string[];
          }>
        >;
      };
      readonly PROCESS: Workflow;
    }
  }
}

const routes = {
  "/api/jobs": "jobs-api",
  "/api/jobs/*": "jobs-api",
};
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;
const migrated = Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));
const password = "test-password-safe-123";
const decodeAccepted = Schema.decodeUnknownEffect(Schema.Struct({ id: Schema.String }));

type App = ReturnType<typeof jobsApp>;

function jobsApp() {
  const runtime = workerRuntime(() =>
    Layer.orDie(appLayer(appEnvironment(), APPLICATION.user, routes)),
  );
  const api = apiRoutes(runtime, reporting);
  return createApi(apiRoot).use(accountApi(api)).use(jobsApi(api));
}

function send(
  app: App,
  path: string,
  init: {
    readonly body?: unknown;
    readonly cookie?: string;
    readonly method?: "GET" | "POST";
    readonly origin?: string;
  },
): Effect.Effect<Response> {
  return Effect.gen(function* sendJobsRequest() {
    const method = init.method ?? (init.body === undefined ? "GET" : "POST");
    const body =
      init.body === undefined
        ? undefined
        : yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(init.body);
    return yield* Effect.promise(() =>
      Promise.resolve(
        app.fetch(
          new Request(`${fixtureOrigin}${apiRoot}${path}`, {
            headers: {
              "content-type": "application/json",
              cookie: init.cookie ?? "",
              origin: init.origin ?? fixtureOrigin,
            },
            method,
            ...(body === undefined ? {} : { body }),
          }),
        ),
      ),
    );
  }).pipe(Effect.orDie);
}

const jsonOf = (response: Response): Effect.Effect<unknown> =>
  Effect.promise(() => response.json() as Promise<unknown>);

const verificationToken = Effect.fn("verificationToken")(function* verificationToken(
  email: string,
) {
  const delivered = yield* Effect.promise(() => env.EMAIL.taken());
  const mail = delivered.findLast((sent) => sent.to.includes(email));
  const link = mail?.text.split("\n").find((line) => line.startsWith("http://")) ?? "";
  return new URLSearchParams(new URL(link).hash.slice(1)).get("token") ?? "";
});

const signedInMember = Effect.fn("signedInMember")(function* signedInMember(
  app: App,
  email: string,
) {
  const signedUp = yield* send(app, "/auth/sign-up/email", {
    body: { email, name: email.split("@")[0], password },
  });
  assert.strictEqual(signedUp.status, httpStatus.ok);
  const token = yield* verificationToken(email);
  const verified = yield* send(app, "/verify-email", { body: { token } });
  assert.strictEqual(verified.status, httpStatus.ok);
  const signedIn = yield* send(app, "/auth/sign-in/email", { body: { email, password } });
  assert.strictEqual(signedIn.status, httpStatus.ok);
  return signedIn.headers
    .getSetCookie()
    .map((header) => header.split(";")[0] ?? "")
    .join("; ");
});

const sessionUserId = Effect.fn("sessionUserId")(function* sessionUserId(app: App, cookie: string) {
  const response = yield* send(app, "/session", { cookie });
  assert.strictEqual(response.status, httpStatus.ok);
  const view = yield* Schema.decodeUnknownEffect(
    Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
  )(yield* jsonOf(response));
  return view.user.id;
});

describe("jobs api", () => {
  it.effect("refuses anonymous callers", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = jobsApp();
      const statuses = yield* Effect.all([
        send(app, "/jobs", { body: {} }),
        send(app, `/jobs/${crypto.randomUUID()}`, {}),
      ]).pipe(Effect.map((responses) => responses.map((response) => response.status)));
      assert.deepStrictEqual(statuses, [httpStatus.unauthorized, httpStatus.unauthorized]);
    }),
  );

  it.effect("refuses a job request from another origin", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const app = jobsApp();
      const cookie = yield* signedInMember(app, "owner@example.test");
      const crossSite = yield* send(app, "/jobs", {
        body: {},
        cookie,
        origin: "https://attacker.example",
      });
      assert.strictEqual(crossSite.status, httpStatus.forbidden);
    }),
  );

  it.effect("runs a member's job and shows its status only to that member", () =>
    Effect.gen(function* program() {
      yield* migrated;
      const jobs = yield* readJobs(env);
      const app = jobsApp();
      const owner = yield* signedInMember(app, "owner@example.test");
      const stranger = yield* signedInMember(app, "stranger@example.test");
      const ownerId = yield* sessionUserId(app, owner);

      const created = yield* send(app, "/jobs", { body: {}, cookie: owner });
      assert.strictEqual(created.status, httpStatus.ok);
      const { id } = yield* decodeAccepted(yield* jsonOf(created));
      const payload = yield* Schema.decodeEffect(JobPayload)({ jobId: id, ownerId });

      const instance = yield* Effect.promise(() =>
        introspectWorkflowInstance(env[jobsWorkflowBinding], `${ownerId}-${id}`),
      );
      const views = yield* Effect.gen(function* observe() {
        yield* Effect.promise(() =>
          instance.modify((modifier: { readonly disableSleeps: () => Promise<void> }) =>
            modifier.disableSleeps(),
          ),
        );

        const batch = createMessageBatch(jobsQueueName, [
          {
            attempts: 1,
            body: payload,
            id,
            timestamp: DateTime.toDate(DateTime.nowUnsafe()),
          },
        ]);
        const context = createExecutionContext();
        yield* Effect.promise(() => consumeJobs(batch, jobs));
        const queueResult = yield* Effect.promise(() => getQueueResult(batch, context));
        assert.deepStrictEqual(queueResult.explicitAcks, [id]);

        yield* Effect.promise(() => instance.waitForStatus("complete"));
        const output = yield* Effect.promise(() => instance.getOutput());
        assert.deepStrictEqual(output, { jobId: id, stage: "complete" });

        const ownView = yield* send(app, `/jobs/${id}`, { cookie: owner });
        const strangerView = yield* send(app, `/jobs/${id}`, { cookie: stranger });
        assert.deepStrictEqual(
          [ownView.status, strangerView.status],
          [httpStatus.ok, httpStatus.notFound],
        );
        return yield* jsonOf(ownView);
      }).pipe(Effect.ensuring(Effect.promise(() => instance.dispose())));

      assert.deepStrictEqual(views, {
        id,
        output: { jobId: id, stage: "complete" },
        status: "complete",
      });
    }),
  );
});
