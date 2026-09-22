import { assert, it } from "@effect/vitest";
import { Auth } from "@repo/auth";
import { APPLICATION, ROLE, SUBSCRIPTION_STATUS, memberApiKeyHeader } from "@repo/config";
import { query, schema } from "@repo/db";
import { TestDatabase, runStatement } from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { appLayer } from "@repo/runtime/bindings";
import { apiRoot, apiRoutes } from "@repo/runtime/http";
import { appEnvironment, fixtureOrigin } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { DateTime, Effect, Layer, Schema } from "effect";

import { memberApi } from "./member-api.ts";
import { memberRequirementLayer } from "./member-requirement-layer.ts";

const { planSubscription, user } = schema;
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;
const routes = {
  "/api/member": "member",
  "/api/members": "members",
  "/api/profile": "profile",
} as const;

const listedAt = DateTime.toDate(DateTime.makeUnsafe("2026-01-02T00:00:00.000Z"));
const encodeBody = Schema.encodePromise(Schema.fromJsonString(Schema.Unknown));

const addMember = (memberId: string, emailVerified = true) =>
  query((database) =>
    database
      .insert(user)
      .values({
        createdAt: listedAt,
        email: `${memberId}@example.com`,
        emailVerified,
        id: memberId,
        name: memberId,
        profile: `${memberId}-profile`,
        role: ROLE.member,
        searchable: true,
        updatedAt: listedAt,
      })
      .then(() => undefined),
  );

const subscribe = (memberId: string) =>
  query((database) =>
    database
      .insert(planSubscription)
      .values({
        memberId,
        status: SUBSCRIPTION_STATUS.active,
        stripeCustomerId: `cus_${memberId}`,
        stripeSubscriptionId: `sub_${memberId}`,
        updatedAt: listedAt,
      })
      .then(() => undefined),
  );

function request(
  app: ReturnType<typeof memberApi>,
  path: string,
  init: Readonly<{
    body?: unknown;
    headers?: Readonly<Record<string, string>>;
    method?: string;
  }> = {},
): Promise<Response> {
  const withBody =
    init.body === undefined
      ? Promise.resolve({} as RequestInit)
      : encodeBody(init.body).then((body): RequestInit => ({
          body,
          headers: { "content-type": "application/json" },
        }));
  return withBody.then((bodyInit) =>
    app.fetch(
      new Request(`${fixtureOrigin}${apiRoot}${path}`, {
        ...bodyInit,
        headers: {
          origin: fixtureOrigin,
          ...bodyInit.headers,
          ...init.headers,
        },
        method: init.method ?? "GET",
      }),
    ),
  );
}

it.effect("lets API keys read allowed resources and rejects writes", () => {
  const environment = appEnvironment();
  const base = Layer.orDie(appLayer(environment, APPLICATION.user, routes));
  const services = Layer.mergeAll(
    base,
    Layer.orDie(memberRequirementLayer(environment)).pipe(Layer.provide(base)),
  );
  const app = memberApi(
    apiRoutes(
      workerRuntime(() => services),
      reporting,
    ),
  );

  return Effect.gen(function* program() {
    yield* Effect.orDie(Effect.provide(runStatement("select 1"), TestDatabase));
    yield* addMember("owner");
    yield* subscribe("owner");
    yield* addMember("listed");
    yield* addMember("hidden", false);
    const created = yield* Effect.gen(function* issueKey() {
      const auth = yield* Auth;
      return yield* Effect.promise(() =>
        (
          auth.instance.api as unknown as {
            createApiKey: (input: unknown) => Promise<{ id: string; key: string }>;
          }
        ).createApiKey({
          body: { name: "read-only", userId: "owner" },
        }),
      );
    }).pipe(Effect.provide(services));
    const profile = yield* Effect.promise(() =>
      request(app, "/profile", {
        headers: { [memberApiKeyHeader]: created.key },
      }),
    );
    const members = yield* Effect.promise(() =>
      request(app, "/members", {
        headers: { [memberApiKeyHeader]: created.key },
      }),
    );
    const hidden = yield* Effect.promise(() =>
      request(app, "/member?id=hidden", {
        headers: { [memberApiKeyHeader]: created.key },
      }),
    );
    const write = yield* Effect.promise(() =>
      request(app, "/profile", {
        body: { name: "blocked", profile: "nope", socialLinks: [] },
        headers: { [memberApiKeyHeader]: created.key },
        method: "PATCH",
      }),
    );
    yield* Effect.gen(function* revokeKey() {
      const auth = yield* Auth;
      yield* Effect.promise(() =>
        (
          auth.instance.api as unknown as {
            updateApiKey: (input: unknown) => Promise<{ id: string }>;
          }
        ).updateApiKey({
          body: { enabled: false, keyId: created.id, userId: "owner" },
        }),
      );
    }).pipe(Effect.provide(services));
    const revoked = yield* Effect.promise(() =>
      request(app, "/profile", {
        headers: { [memberApiKeyHeader]: created.key },
      }),
    );
    assert.strictEqual(profile.status, httpStatus.ok);
    assert.strictEqual(members.status, httpStatus.ok);
    assert.strictEqual(hidden.status, httpStatus.notFound);
    assert.strictEqual(write.status, httpStatus.forbidden);
    assert.strictEqual(revoked.status, httpStatus.unauthorized);
    const profileBody = yield* Effect.promise(() =>
      profile.json().then((body) => body as { email: string; id: string }),
    );
    assert.strictEqual(profileBody.id, "owner");
    const membersBody = yield* Effect.promise(() =>
      members.json().then((body) => body as { members: readonly { id: string }[] }),
    );
    assert.deepStrictEqual(
      membersBody.members.map((member) => member.id).toSorted(),
      ["listed", "owner"].toSorted(),
    );
  }).pipe(Effect.provide(TestDatabase));
});
