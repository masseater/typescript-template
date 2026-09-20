import { assert, it } from "@effect/vitest";
import { readConfig } from "@repo/config";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { appLayer } from "@repo/runtime";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { env } from "cloudflare:workers";
import { Effect, Layer } from "effect";

import { contactApi } from "./contact-api.ts";
import { opsMailLayer } from "./ops-mail.ts";

const contactRateLimitMax = 5;

const routes = { "/api/contact": "contact-api" };
const reporting = { log: recordingSink().sink, service: "service-member" } as const;
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
  return Effect.promise(async () => env.EMAIL.taken());
}

function contactApp() {
  const environment = appEnvironment({ OPS_EMAIL: opsEmail });
  const runtime = workerRuntime(() =>
    Layer.merge(
      Layer.orDie(appLayer(environment, "service-member", routes)),
      Layer.unwrap(readConfig(environment).pipe(Effect.map(opsMailLayer), Effect.orDie)),
    ),
  );
  return createApi(apiRoot).use(contactApi(apiRoutes(runtime, reporting)));
}

async function postContact(
  app: ReturnType<typeof contactApp>,
  body: unknown,
  network: Readonly<Record<string, string>> = {},
): Promise<Response> {
  return app.fetch(
    new Request(`${fixtureOrigin}${apiRoot}/contact`, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
        origin: fixtureOrigin,
        ...network,
      },
      method: "POST",
    }),
  );
}

it.effect("delivers a logged-out contact submission to the ops mailbox", () =>
  Effect.gen(function* program() {
    yield* migrated;
    yield* drainMailbox();
    const app = contactApp();
    const response = yield* Effect.promise(async () => postContact(app, submission));
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
      statuses.push(
        (yield* Effect.promise(async () => postContact(app, submission, spender))).status,
      );
    }
    assert.deepStrictEqual(
      statuses.slice(0, contactRateLimitMax),
      Array.from({ length: contactRateLimitMax }, () => httpStatus.ok),
    );
    assert.strictEqual(statuses.at(-1), httpStatus.tooManyRequests);
    assert.strictEqual(
      (yield* Effect.promise(async () =>
        postContact(app, submission, { "cf-connecting-ip": "203.0.113.41" }),
      )).status,
      httpStatus.ok,
    );
  }),
);
