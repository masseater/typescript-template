import { assert, it } from "@effect/vitest";
import { APPLICATION, httpStatus } from "@repo/config";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { recordingSink } from "@repo/observability/testing";
import { appLayer, readWorkerConfig } from "@repo/runtime/bindings";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, Layer, Schema } from "effect";

import { contactApi } from "./contact-api.ts";
import { opsMailLayer } from "./ops-mail.ts";

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
    }
  }
}

const contactRateLimitMax = 5;

const routes = { "/api/contact": "contact-api" };
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;
const migrated = Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));
const opsEmail = "ops@example.test";

const submission = {
  email: "visitor@example.test",
  message: "取引の相談をしたいです。",
  name: "来訪者",
} as const;

function drainMailbox(): Effect.Effect<
  ReadonlyArray<{
    readonly subject: string;
    readonly text: string;
    readonly to: string | readonly string[];
  }>
> {
  return Effect.promise(() => env.EMAIL.taken());
}

function contactApp() {
  const environment = appEnvironment({ OPS_EMAIL: opsEmail });
  const runtime = workerRuntime(() =>
    Layer.merge(
      Layer.orDie(appLayer({ env: environment, audience: APPLICATION.user, routes: routes })),
      Layer.unwrap(readWorkerConfig(environment).pipe(Effect.map(opsMailLayer), Effect.orDie)),
    ),
  );
  return createApi(apiRoot).use(contactApi(apiRoutes(runtime, reporting)));
}

function postContact(
  app: ReturnType<typeof contactApp>,
  body: unknown,
  network: Readonly<Record<string, string>> = {},
): Effect.Effect<Response> {
  return Effect.gen(function* sendContact() {
    const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(body);
    return yield* Effect.promise(() =>
      Promise.resolve(
        app.fetch(
          new Request(`${fixtureOrigin}${apiRoot}/contact`, {
            body: encoded,
            headers: {
              "content-type": "application/json",
              origin: fixtureOrigin,
              ...network,
            },
            method: "POST",
          }),
        ),
      ),
    );
  }).pipe(Effect.orDie);
}

it.effect("delivers a logged-out contact submission to the ops mailbox", () =>
  Effect.gen(function* program() {
    yield* migrated;
    yield* drainMailbox();
    const app = contactApp();
    const response = yield* postContact(app, submission);
    assert.strictEqual(response.status, httpStatus.ok);
    const [delivered] = yield* drainMailbox();
    assert.isDefined(delivered);
    assert.strictEqual(Array.isArray(delivered.to) ? delivered.to[0] : delivered.to, opsEmail);
    assert.strictEqual(delivered.subject, "お問い合わせ");
    assert.include(delivered.text, submission.name);
    assert.include(delivered.text, submission.email);
    assert.include(delivered.text, submission.message);
  }),
);

it.effect("rejects further contact submissions after the rate limit is spent", () =>
  Effect.gen(function* program() {
    yield* migrated;
    yield* drainMailbox();
    const app = contactApp();
    const spender = { "cf-connecting-ip": "203.0.113.40" };
    const statuses: number[] = [];
    for (let attempt = 0; attempt < contactRateLimitMax + 1; attempt += 1) {
      statuses.push((yield* postContact(app, submission, spender)).status);
    }
    assert.deepStrictEqual(
      statuses.slice(0, contactRateLimitMax),
      Array.from({ length: contactRateLimitMax }, () => httpStatus.ok),
    );
    assert.strictEqual(statuses.at(-1), httpStatus.tooManyRequests);
    assert.strictEqual(
      (yield* postContact(app, submission, { "cf-connecting-ip": "203.0.113.41" })).status,
      httpStatus.ok,
    );
  }),
);
