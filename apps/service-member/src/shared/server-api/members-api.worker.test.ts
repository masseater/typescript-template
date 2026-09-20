import {
  authTest,
  authTestSecret,
  origins,
  registerVerified,
  runWith,
  signInAs,
} from "@repo/auth/testing";
import { APPLICATION, SUBSCRIPTION_STATUS } from "@repo/config";
import { query, recordSubscription, schema } from "@repo/db";
import { TestDatabase } from "@repo/db/testing";
import { httpStatus } from "@repo/observability";
import { recordingSink } from "@repo/observability/testing";
import { appLayer } from "@repo/runtime";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { appEnvironment } from "@repo/runtime/testing";
import { workerRuntime } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";
import { describe, expect } from "vite-plus/test";

import { membersApi } from "./members-api.ts";

import type { BrowserClient } from "@repo/auth/testing";

const { user } = schema;
const origin = origins[APPLICATION.user];
const reporting = { log: recordingSink().sink, service: APPLICATION.user } as const;
const routes = { "/api/members": "members-api" };
const recordedAt = new Date("2026-01-02T00:00:00.000Z");
const monthLater = new Date("2026-10-20T00:00:00.000Z");

type App = ReturnType<typeof membersApp>;

function membersApp() {
  const environment = appEnvironment({ APP_ORIGIN: origin, AUTH_SECRET: authTestSecret });
  const runtime = workerRuntime(() => Layer.orDie(appLayer(environment, APPLICATION.user, routes)));
  const api = apiRoutes(runtime, reporting);
  return createApi(apiRoot).use(membersApi(api));
}

function call(app: App, client: BrowserClient, path: string): Effect.Effect<Response> {
  return Effect.promise(async () =>
    app.fetch(
      new Request(`${origin}${apiRoot}${path}`, {
        headers: Object.fromEntries(client.cookieHeaders()),
        method: "GET",
      }),
    ),
  );
}

const addListedMember = (memberId: string) =>
  query(async (database): Promise<void> => {
    await database.insert(user).values({
      createdAt: recordedAt,
      email: `${memberId}@example.com`,
      emailVerified: true,
      id: memberId,
      name: memberId,
      role: "member",
      searchable: true,
      updatedAt: recordedAt,
      visibility: "all_members",
    });
  });

const addPaid = (memberId: string) =>
  recordSubscription(
    { createdAt: recordedAt, id: `evt_${memberId}`, type: "customer.subscription.updated" },
    {
      cancelAtPeriodEnd: false,
      currentPeriodEnd: monthLater,
      memberId,
      status: SUBSCRIPTION_STATUS.active,
      stripeCustomerId: `cus_${memberId}`,
      stripeSubscriptionId: `sub_${memberId}`,
    },
  );

describe("members api", () => {
  const it = authTest();

  it("refuses the member list to free members and lets paid members search", async ({ auth }) => {
    const result = await runWith(auth, () =>
      Effect.gen(function* program() {
        const app = membersApp();
        yield* addListedMember("listed");
        yield* registerVerified("free@example.com");
        const freeClient = yield* signInAs(APPLICATION.user, "free@example.com");
        const refused = yield* call(app, freeClient, "/members?page=1");
        yield* registerVerified("paid@example.com");
        const paidClient = yield* signInAs(APPLICATION.user, "paid@example.com");
        const paidSession = yield* paidClient.verify();
        yield* addPaid(paidSession.user.id);
        const admitted = yield* call(app, paidClient, "/members?page=1");
        const searched = yield* call(app, paidClient, "/members?keyword=listed&page=1");
        const admittedBody = yield* Effect.promise(
          async () => (await admitted.json()) as { members: readonly { id: string }[] },
        );
        const searchedBody = yield* Effect.promise(
          async () => (await searched.json()) as { members: readonly { id: string }[] },
        );
        return { admittedBody, refused: refused.status, searchedBody };
      }).pipe(Effect.provide(TestDatabase)),
    );
    expect(result.refused).toBe(httpStatus.paymentRequired);
    expect(result.admittedBody.members.map((member) => member.id)).toStrictEqual(["listed"]);
    expect(result.searchedBody.members.map((member) => member.id)).toStrictEqual(["listed"]);
  });
});
