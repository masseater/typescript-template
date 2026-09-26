import { assert, describe, it } from "@effect/vitest";
import { httpStatus } from "@repo/config";
import { dashboardStaff, type ReadOnlyDashboardStaff } from "@repo/db";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";
import { fixtureOrigin } from "@repo/runtime/testing";
import { Effect } from "effect";
import { expect } from "vite-plus/test";

import { dashboardApi } from "./dashboard-api.ts";
import { reporting, runtime } from "./runtime.ts";

function dashboardApp() {
  const api = apiRoutes(runtime, reporting);
  return createApi(apiRoot).use(dashboardApi(api));
}

function postDashboard(path: string): Promise<number> {
  const app = dashboardApp();
  return Promise.resolve(
    app.fetch(
      new Request(`${fixtureOrigin}${apiRoot}${path}`, {
        body: "{}",
        headers: { "content-type": "application/json", origin: fixtureOrigin },
        method: "POST",
      }),
    ),
  ).then((response) => response.status);
}

it.effect("rejects write requests on dashboard routes", () =>
  Effect.gen(function* program() {
    assert.strictEqual(
      yield* Effect.promise(() => postDashboard("/overview")),
      httpStatus.notFound,
    );
    assert.strictEqual(
      yield* Effect.promise(() => postDashboard("/metrics/trend")),
      httpStatus.notFound,
    );
    assert.strictEqual(yield* Effect.promise(() => postDashboard("/audit")), httpStatus.notFound);
  }),
);

describe("the staff surface", () => {
  it("exposes only read-only dashboard staff operations", () => {
    const staff: ReadOnlyDashboardStaff = dashboardStaff;
    expect(staff).toStrictEqual({
      auditEvents: expect.any(Function),
      metricTrend: expect.any(Function),
      overview: expect.any(Function),
      overviewWithoutPii: expect.any(Function),
    });
  });
});
